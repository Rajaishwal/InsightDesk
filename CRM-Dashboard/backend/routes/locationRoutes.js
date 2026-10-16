import express from 'express';
import {
  updateLocation,
  getAllEmployeeLocations,
} from '../controllers/locationController.js';
import { protect, hrOrAdmin } from '../middleware/authMiddleware.js';
import Location from '../model/Location.js';
import User from '../model/User.js';
import Attendance from '../model/Attendance.js';
import { openSessionFilter } from '../utils/istDate.js';

const router = express.Router();

// Employee: save my location
router.post('/update', protect, updateLocation);

// HR/Admin: everyone's current location
router.get('/all-employees', protect, hrOrAdmin, getAllEmployeeLocations);

// Clear the location data of employees who aren't working right now (no open check-in session).
// Anyone checked in keeps their history — however long ago their last location update was
// (the tracker only saves every 30 min when someone isn't moving).
router.delete('/clear-inactive', protect, hrOrAdmin, async (req, res) => {
  try {
    const working = await Attendance.distinct('userId', openSessionFilter());

    const inactiveIds = (await User.find({ _id: { $nin: working } }).select('_id').lean()).map((u) => u._id);

    // Count who actually has something to clear before deleting
    const [withHistory, withCurrent] = await Promise.all([
      Location.distinct('userId', { userId: { $in: inactiveIds } }),
      User.distinct('_id', { _id: { $in: inactiveIds }, currentLocation: { $exists: true, $ne: null } }),
    ]);
    const clearedUserCount = new Set([...withHistory, ...withCurrent].map(String)).size;

    const deleteResult = await Location.deleteMany({ userId: { $in: inactiveIds } });
    await User.updateMany({ _id: { $in: inactiveIds } }, { $unset: { currentLocation: 1 } });

    res.json({
      success: true,
      message: `Cleared ${deleteResult.deletedCount} location records for ${clearedUserCount} employees who aren't checked in`,
      deletedCount: deleteResult.deletedCount,
      clearedUsers: clearedUserCount
    });
    
  } catch (error) {
    console.error('❌ Error clearing inactive data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
