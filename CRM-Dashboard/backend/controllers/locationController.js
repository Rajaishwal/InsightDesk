import Location from '../model/Location.js';
import User from '../model/User.js';
import Attendance from '../model/Attendance.js';
import Break from '../models/Break.js';
import { findOpenAttendance, openSessionFilter } from '../utils/istDate.js';

// Update employee location
export const updateLocation = async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      address, 
      city, 
      state, 
      country, 
      accuracy,
    } = req.body;
    const userId = req.user._id;

    // Check if user is currently checked in (session may span midnight)
    const currentAttendance = await findOpenAttendance(Attendance, userId);

    if (!currentAttendance) {
      return res.status(403).json({ 
        message: 'Location tracking is only active during work hours. Please check in first.',
        requiresCheckIn: true
      });
    }

    // Validation
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ message: 'Invalid latitude value' });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: 'Invalid longitude value' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const coordinates = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    };

    // Get the user's last location entry
    const lastLocation = await Location.findOne({ 
      userId, 
      isActive: true 
    }).sort({ timestamp: -1 });

    let shouldCreateNewRecord = true;
    const now = new Date();
    
    // Coordinate precision threshold (configurable)
    // 0.0001 degrees ≈ 10 meters precision
    // 0.0010 degrees ≈ 100 meters precision  
    // 0.0100 degrees ≈ 1 kilometer precision
    const coordinatePrecision = 0.0001; // Currently set to ~10 meters
    

    if (lastLocation) {
      // Check if coordinates are the same (within precision threshold)
      const latDiff = Math.abs(lastLocation.coordinates.latitude - coordinates.latitude);
      const lonDiff = Math.abs(lastLocation.coordinates.longitude - coordinates.longitude);
      const coordinatesAreSame = latDiff < coordinatePrecision && lonDiff < coordinatePrecision;

      if (coordinatesAreSame) {
        // Same coordinates - ALWAYS overwrite existing record, regardless of time
        lastLocation.coordinates = coordinates;
        lastLocation.address = address || lastLocation.address;
        lastLocation.city = city || lastLocation.city;
        lastLocation.state = state || lastLocation.state;
        lastLocation.country = country || lastLocation.country;
        lastLocation.accuracy = accuracy || lastLocation.accuracy;
        lastLocation.timestamp = now;
        
        await lastLocation.save();
        shouldCreateNewRecord = false;
      }
      // Different coordinates → a new record is created below
    }

    if (shouldCreateNewRecord) {
      // Create new location record for significant changes or 30-minute intervals
      const newLocation = new Location({
        userId,
        coordinates,
        address: address || '',
        city: city || '',
        state: state || '',
        country: country || '',
        accuracy: accuracy || 0
      });

      await newLocation.save();
    }

    // Update user's current location
    await User.findByIdAndUpdate(userId, {
      currentLocation: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        lastUpdated: now
      }
    });

    res.status(200).json({ 
      message: 'Location updated successfully',
      updateType: shouldCreateNewRecord ? 'new_record' : 'overwrite',
      coordinates
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server error while updating location' });
  }
};

// HR/Admin: Get all employees' current locations
export const getAllEmployeeLocations = async (req, res) => {
  try {
    // Employees whose location is being tracked
    const employees = await User.find(
      { currentLocation: { $exists: true, $ne: null } },
      'name email employeeId designation role photo currentLocation'
    ).lean();
    const ids = employees.map((u) => u._id);

    const [latest, openSessions, openBreaks] = await Promise.all([
      // Latest saved location (address etc.) per employee
      Location.aggregate([
        { $match: { userId: { $in: ids } } },
        { $sort: { userId: 1, timestamp: -1 } },
        { $group: { _id: '$userId', loc: { $first: '$$ROOT' } } },
      ]),
      // Check-in status comes from attendance itself (not from location history, which may have been cleared),
      // using the shared open-session rule (checked in within 16h, or today)
      Attendance.find({ userId: { $in: ids }, ...openSessionFilter() })
        .select('userId checkInTime').lean(),
      Break.find({ userId: { $in: ids }, endTime: null }).select('userId startTime').lean(),
    ]);
    const latestBy = Object.fromEntries(latest.map((l) => [String(l._id), l.loc]));
    const sessionBy = Object.fromEntries(openSessions.map((a) => [String(a.userId), a]));
    const breakBy = Object.fromEntries(openBreaks.map((b) => [String(b.userId), b]));

    const employeeLocations = employees.map((user) => {
      const uid = String(user._id);
      const loc = latestBy[uid] || null;
      const session = sessionBy[uid];
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        designation: user.designation,
        role: user.role,
        photo: user.photo,
        currentLocation: user.currentLocation,
        lastLocationUpdate: loc ? loc.timestamp : null,
        latestLocationData: loc,
        isLocationActive: loc ? loc.isActive : false,
        attendanceStatus: session ? 'checked-in' : 'not-checked-in',
        checkInTime: session?.checkInTime || null,
        onBreak: !!(session && breakBy[uid]),
      };
    });

    res.status(200).json({
      success: true,
      employees: employeeLocations,
      count: employeeLocations.length
    });

  } catch (error) {
    console.error('Get all employee locations error:', error);
    res.status(500).json({ message: 'Server error while fetching employee locations' });
  }
};

