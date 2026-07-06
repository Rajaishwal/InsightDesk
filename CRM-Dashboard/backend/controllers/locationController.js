import Location from '../model/Location.js';
import User from '../model/User.js';
import Attendance from '../model/Attendance.js';

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
};

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
      hasLocationChanged 
    } = req.body;
    const userId = req.user._id;

    // Check if user is currently checked in
    const today = new Date().toISOString().split('T')[0];
    const currentAttendance = await Attendance.findOne({
      userId,
      date: today,
      status: "checked-in"
    });

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
    
    console.log('🔍 Checking coordinates for update logic...');

    if (lastLocation) {
      // Check if coordinates are the same (within precision threshold)
      const latDiff = Math.abs(lastLocation.coordinates.latitude - coordinates.latitude);
      const lonDiff = Math.abs(lastLocation.coordinates.longitude - coordinates.longitude);
      const coordinatesAreSame = latDiff < coordinatePrecision && lonDiff < coordinatePrecision;
      
      // Check time difference (in minutes) - for logging purposes only
      const timeDiff = (now - new Date(lastLocation.timestamp)) / (1000 * 60);
      
      console.log('📍 Coordinate comparison:', {
        lastLocation: lastLocation.coordinates,
        newCoordinates: coordinates,
        latDiff,
        lonDiff,
        coordinatesAreSame,
        threshold: coordinatePrecision,
        timeDiffMinutes: timeDiff.toFixed(2)
      });
      
      if (coordinatesAreSame) {
        // Same coordinates - ALWAYS overwrite existing record, regardless of time
        console.log('✅ Same coordinates detected - overwriting existing record (regardless of time)');
        lastLocation.coordinates = coordinates;
        lastLocation.address = address || lastLocation.address;
        lastLocation.city = city || lastLocation.city;
        lastLocation.state = state || lastLocation.state;
        lastLocation.country = country || lastLocation.country;
        lastLocation.accuracy = accuracy || lastLocation.accuracy;
        lastLocation.timestamp = now;
        
        await lastLocation.save();
        shouldCreateNewRecord = false;
        console.log('📝 Updated existing location record with new timestamp');
      } else {
        // Different coordinates - will create new record
        console.log('🆕 Different coordinates detected - will create new record');
      }
    } else {
      console.log('🔍 No previous location found - will create first record');
    }

    if (shouldCreateNewRecord) {
      // Create new location record for significant changes or 30-minute intervals
      console.log('➕ Creating new location record...');
      const newLocation = new Location({
        userId,
        coordinates,
        address: address || '',
        city: city || '',
        state: state || '',
        country: country || '',
        accuracy: accuracy || 0
      });

      const savedLocation = await newLocation.save();
      console.log('✅ New location record created:', savedLocation._id);
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

// Get employee's current location
export const getCurrentLocation = async (req, res) => {
  try {
    const userId = req.user._id;

    const currentLocation = await Location.findOne({ 
      userId,
      isActive: true 
    }).sort({ timestamp: -1 });

    if (!currentLocation) {
      return res.status(404).json({ message: 'No location data found' });
    }

    res.status(200).json({
      location: currentLocation
    });

  } catch (error) {
    console.error('Get current location error:', error);
    res.status(500).json({ message: 'Server error while fetching location' });
  }
};

// Get employee's location history
export const getLocationHistory = async (req, res) => {
  try {
    // Check if userId is provided in query (for admin requests)
    const targetUserId = req.query.userId || req.user._id;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    console.log('🔍 getLocationHistory called:', {
      requestedUserId: req.query.userId,
      currentUserId: req.user._id.toString(),
      currentUserRole: req.user.role,
      targetUserId
    });

    // Temporarily remove role restriction for debugging
    // TODO: Re-enable this check after debugging
    /*
    if (req.query.userId && req.query.userId !== req.user._id.toString()) {
      if (req.user.role !== 'admin' && req.user.role !== 'hr') {
        return res.status(403).json({ message: 'Access denied. Admin or HR privileges required.' });
      }
    }
    */

    const query = { userId: targetUserId, isActive: true };

    // Date filtering
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const locations = await Location.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalRecords = await Location.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limit);

    console.log('📍 Location history query results:', {
      query,
      totalRecords,
      locationsFound: locations.length,
      sampleLocation: locations[0] || 'No locations found'
    });

    res.status(200).json({
      success: true,
      locations,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ message: 'Server error while fetching location history' });
  }
};

// HR/Admin: Get all employees' current locations
export const getAllEmployeeLocations = async (req, res) => {
  try {
    console.log('🔍 getAllEmployeeLocations called by user:', req.user?.name, 'Role:', req.user?.role);
    
    // Get today's date for attendance check
    const today = new Date().toISOString().split('T')[0];
    
    // Get latest location for each user (both active and inactive)
    const locations = await Location.aggregate([
      {
        $sort: { userId: 1, timestamp: -1 }
      },
      {
        $group: {
          _id: '$userId',
          latestLocation: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $lookup: {
          from: 'attendances',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$date', today] }
                  ]
                }
              }
            }
          ],
          as: 'todayAttendance'
        }
      },
      {
        $project: {
          _id: '$latestLocation._id',
          userId: '$latestLocation.userId',
          userName: '$user.name',
          userEmail: '$user.email',
          employeeId: '$user.employeeId',
          coordinates: '$latestLocation.coordinates',
          address: '$latestLocation.address',
          city: '$latestLocation.city',
          state: '$latestLocation.state',
          country: '$latestLocation.country',
          timestamp: '$latestLocation.timestamp',
          isActive: '$latestLocation.isActive',
          attendanceStatus: {
            $cond: {
              if: { $gt: [{ $size: '$todayAttendance' }, 0] },
              then: { $arrayElemAt: ['$todayAttendance.status', 0] },
              else: 'not-checked-in'
            }
          }
        }
      },
      {
        $sort: { timestamp: -1 }
      }
    ]);

    console.log('📍 Location aggregation result:', locations.length, 'records');

    // Format the response to include user details in currentLocation
    // Only get users who have currentLocation data (active location tracking)
    const employees = await User.find({ 
      currentLocation: { $exists: true, $ne: null } 
    }, 'name email employeeId currentLocation')
      .lean();

    console.log('👥 Users with active location found:', employees.length);

    // Merge location data with user data
    const employeeLocations = employees.map(user => {
      const locationData = locations.find(loc => loc.userId.toString() === user._id.toString());
      
      const result = {
        _id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        currentLocation: user.currentLocation,
        lastLocationUpdate: locationData ? locationData.timestamp : null,
        latestLocationData: locationData || null,
        isLocationActive: locationData ? locationData.isActive : false,
        attendanceStatus: locationData ? locationData.attendanceStatus : 'not-checked-in'
      };
      
      console.log(`📊 User ${user.name}:`, {
        hasCurrentLocation: !!user.currentLocation,
        hasLocationData: !!locationData,
        attendanceStatus: result.attendanceStatus,
        currentLocation: user.currentLocation
      });
      
      return result;
    });

    console.log('📋 Final employee locations:', employeeLocations.length);

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

// Clear all location history (Admin only)
export const clearAllLocationHistory = async (req, res) => {
  try {
    // Check if user is admin (you might want to add role checking here)
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Optional: Add admin role check if you have roles implemented
    // if (user.role !== 'admin') {
    //   return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    // }

    // Delete all location records
    const result = await Location.deleteMany({});
    
    res.status(200).json({ 
      message: 'All location history cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing location history:', error);
    res.status(500).json({ message: 'Failed to clear location history' });
  }
};
