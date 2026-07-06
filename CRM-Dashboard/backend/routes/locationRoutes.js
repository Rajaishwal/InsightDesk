// import express from 'express';
// import {
//   updateLocation,
//   getCurrentLocation,
//   getLocationHistory,
//   getAllEmployeeLocations,
//   clearAllLocationHistory,
//   clearInactiveLocationRecords
// } from '../controllers/locationController.js';
// import { protect, hrOrAdmin } from '../middleware/authMiddleware.js';
// import Location from '../model/Location.js';
// import User from '../model/User.js';

// const router = express.Router();

// // Employee routes
// router.post('/update', protect, updateLocation);
// router.get('/current', protect, getCurrentLocation);
// router.get('/history', protect, getLocationHistory);

// // HR/Admin routes - temporarily remove role restriction for debugging
// router.get('/all-employees', protect, getAllEmployeeLocations);
// router.delete('/clear-all', protect, hrOrAdmin, clearAllLocationHistory);
// // New route to clear only inactive location records
// router.delete('/clear-inactive', protect, hrOrAdmin, clearInactiveLocationRecords);

// // Debug endpoint to check current user role
// router.get('/debug-user', protect, async (req, res) => {
//   try {
//     res.json({
//       success: true,
//       user: {
//         id: req.user._id,
//         name: req.user.name,
//         email: req.user.email,
//         role: req.user.role,
//         employeeId: req.user.employeeId
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Test endpoint to create sample location data
// router.post('/test-create', protect, async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const now = new Date();
    
//     // Create a test location record
//     const testLocation = new Location({
//       userId,
//       coordinates: {
//         latitude: 22.5726,
//         longitude: 88.3639
//       },
//       address: "Test Address, Kolkata",
//       city: "Kolkata",
//       state: "West Bengal",
//       country: "India",
//       accuracy: 10,
//       timestamp: now,
//       isActive: true
//     });
    
//     await testLocation.save();
    
//     // Update user's current location
//     await User.findByIdAndUpdate(userId, {
//       currentLocation: {
//         latitude: 22.5726,
//         longitude: 88.3639,
//         lastUpdated: now
//       }
//     });
    
//     res.json({ message: 'Test location created', location: testLocation });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Test endpoint to simulate location update with coordinate comparison
// router.post('/test-update', protect, async (req, res) => {
//   try {
//     const { latitude, longitude, sameLocation = false } = req.body;
    
//     let testLat, testLng;
    
//     if (sameLocation) {
//       // Use existing coordinates with minimal variation (should trigger overwrite)
//       const lastLocation = await Location.findOne({ 
//         userId: req.user._id, 
//         isActive: true 
//       }).sort({ timestamp: -1 });
      
//       if (lastLocation) {
//         testLat = lastLocation.coordinates.latitude + 0.00001; // Very small change (~1 meter)
//         testLng = lastLocation.coordinates.longitude + 0.00001;
//       } else {
//         testLat = 22.5726;
//         testLng = 88.3639;
//       }
//     } else {
//       // Use provided coordinates or generate significantly different ones
//       testLat = latitude || (22.5726 + (Math.random() - 0.5) * 0.01); // Larger variation (~500 meters)
//       testLng = longitude || (88.3639 + (Math.random() - 0.5) * 0.01);
//     }

//     // Call the actual updateLocation endpoint
//     const updateResponse = await fetch(`http://localhost:5000/api/location/update`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': req.headers.authorization
//       },
//       body: JSON.stringify({
//         latitude: testLat,
//         longitude: testLng,
//         address: sameLocation ? 'Same Location Test' : 'Different Location Test',
//         city: 'Kolkata',
//         state: 'West Bengal',
//         country: 'India',
//         accuracy: 50
//       })
//     });

//     const updateResult = await updateResponse.json();

//     res.json({
//       success: true,
//       message: `Test update completed (${sameLocation ? 'same' : 'different'} location)`,
//       result: updateResult,
//       coordinates: { latitude: testLat, longitude: testLng },
//       expectedBehavior: sameLocation ? 'Should overwrite existing record' : 'Should create new record'
//     });

//   } catch (error) {
//     console.error('Error in test update:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Cleanup endpoint to remove duplicate coordinates
// router.post('/cleanup-duplicates', protect, async (req, res) => {
//   try {
//     console.log('🧹 Starting duplicate coordinates cleanup...');
    
//     // Get all users
//     const users = await User.find({}, '_id name');
//     let totalCleaned = 0;
    
//     for (const user of users) {
//       console.log(`🔍 Processing user: ${user.name} (${user._id})`);
      
//       // Get all locations for this user, sorted by timestamp
//       const locations = await Location.find({ 
//         userId: user._id, 
//         isActive: true 
//       }).sort({ timestamp: -1 });
      
//       if (locations.length <= 1) {
//         console.log(`   ✅ User has ${locations.length} location(s), skipping`);
//         continue;
//       }
      
//       const coordinatePrecision = 0.0001; // Same as update logic
//       const toDelete = [];
//       const keepLatest = new Map(); // Map to store latest entry for each coordinate
      
//       // First pass: identify the latest entry for each coordinate
//       for (const location of locations) {
//         const lat = Math.round(location.coordinates.latitude / coordinatePrecision) * coordinatePrecision;
//         const lng = Math.round(location.coordinates.longitude / coordinatePrecision) * coordinatePrecision;
//         const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        
//         if (!keepLatest.has(coordKey) || new Date(location.timestamp) > new Date(keepLatest.get(coordKey).timestamp)) {
//           // If we already had an entry for this coordinate, mark the old one for deletion
//           if (keepLatest.has(coordKey)) {
//             toDelete.push(keepLatest.get(coordKey)._id);
//           }
//           keepLatest.set(coordKey, location);
//         } else {
//           // This location is older than the one we're keeping
//           toDelete.push(location._id);
//         }
//       }
      
//       console.log(`   📊 Analysis: ${locations.length} total locations, ${keepLatest.size} unique coordinates, ${toDelete.length} duplicates to remove`);
      
//       if (toDelete.length > 0) {
//         await Location.deleteMany({ _id: { $in: toDelete } });
//         totalCleaned += toDelete.length;
//         console.log(`   🧹 Deleted ${toDelete.length} duplicate location(s) for ${user.name}`);
//       }
//     }
    
//     console.log(`🎉 Cleanup complete! Removed ${totalCleaned} duplicate locations total.`);
    
//     res.json({
//       success: true,
//       message: `Cleanup completed successfully`,
//       totalCleaned,
//       details: `Removed ${totalCleaned} duplicate location records`
//     });
    
//   } catch (error) {
//     console.error('❌ Error during cleanup:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Remove all test/fake location data and keep only real coordinates
// router.post('/clear-test-data', protect, async (req, res) => {
//   try {
//     console.log('🧹 Starting AGGRESSIVE test data cleanup...');
    
//     // Get all locations to analyze
//     const allLocations = await Location.find({ isActive: true });
//     console.log(`📊 Total locations found: ${allLocations.length}`);
    
//     // Define what we consider "test" data
//     const testPatterns = [
//       'Test Address',
//       'Test Location', 
//       'Same Location Test',
//       'Different Location Test',
//       'Test',
//       'test'
//     ];
    
//     // Common test coordinates (exact matches)
//     // const testCoordinates = [
//     //   { lat: 22.5726, lng: 88.3639 },  // Main test coordinate
//     //   { lat: 22.5726, lng: 88.3639 },  // Common test variations
//     // ];
    
//     let deletedCount = 0;
    
//     for (const location of allLocations) {
//       let isTestData = false;
      
//       // Check 1: Address contains test keywords
//       if (location.address) {
//         const hasTestKeyword = testPatterns.some(pattern => 
//           location.address.toLowerCase().includes(pattern.toLowerCase())
//         );
//         if (hasTestKeyword) {
//           console.log(`🗑️ Test address found: ${location.address}`);
//           isTestData = true;
//         }
//       }
      
//       // Check 2: Exact test coordinates
//       const isTestCoordinate = testCoordinates.some(testCoord => 
//         Math.abs(location.coordinates.latitude - testCoord.lat) < 0.00001 &&
//         Math.abs(location.coordinates.longitude - testCoord.lng) < 0.00001
//       );
//       if (isTestCoordinate) {
//         console.log(`🗑️ Test coordinate found: ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
//         isTestData = true;
//       }
      
//       // Check 3: Suspicious accuracy values
//       if (location.accuracy === 0 || location.accuracy === 10 || location.accuracy === 50 || location.accuracy > 1000000) {
//         console.log(`🗑️ Suspicious accuracy found: ${location.accuracy}`);
//         isTestData = true;
//       }
      
//       // Check 4: Duplicate coordinates (keep only the latest for each coordinate)
//       const duplicates = allLocations.filter(loc => 
//         loc._id.toString() !== location._id.toString() &&
//         Math.abs(loc.coordinates.latitude - location.coordinates.latitude) < 0.0001 &&
//         Math.abs(loc.coordinates.longitude - location.coordinates.longitude) < 0.0001
//       );
      
//       if (duplicates.length > 0) {
//         // Check if this is the latest entry for these coordinates
//         const isLatest = duplicates.every(dup => 
//           new Date(location.timestamp) >= new Date(dup.timestamp)
//         );
        
//         if (!isLatest) {
//           console.log(`�️ Duplicate coordinate (older): ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
//           isTestData = true;
//         }
//       }
      
//       // Delete if identified as test data
//       if (isTestData) {
//         await Location.findByIdAndDelete(location._id);
//         deletedCount++;
//       }
//     }
    
//     console.log(`🗑️ Deleted ${deletedCount} test/duplicate location entries`);
    
//     // Clean up user currentLocation with test data
//     const users = await User.find({});
//     let usersUpdated = 0;
    
//     for (const user of users) {
//       if (user.currentLocation) {
//         const { latitude, longitude } = user.currentLocation;
        
//         // Check if user's currentLocation is test data
//         const isTestCurrentLocation = testCoordinates.some(testCoord => 
//           Math.abs(latitude - testCoord.lat) < 0.00001 &&
//           Math.abs(longitude - testCoord.lng) < 0.00001
//         );
        
//         if (isTestCurrentLocation) {
//           // Find their latest REAL location
//           const latestRealLocation = await Location.findOne({
//             userId: user._id,
//             isActive: true
//           }).sort({ timestamp: -1 });
          
//           if (latestRealLocation) {
//             user.currentLocation = {
//               latitude: latestRealLocation.coordinates.latitude,
//               longitude: latestRealLocation.coordinates.longitude,
//               lastUpdated: latestRealLocation.timestamp
//             };
//             console.log(`✅ Updated ${user.name}'s currentLocation to real coordinates`);
//           } else {
//             user.currentLocation = undefined;
//             console.log(`🔄 Cleared ${user.name}'s currentLocation (no real data)`);
//           }
          
//           await user.save();
//           usersUpdated++;
//         }
//       }
//     }
    
//     // Final cleanup: Remove any remaining exact duplicates
//     const pipeline = [
//       {
//         $group: {
//           _id: {
//             userId: '$userId',
//             lat: '$coordinates.latitude',
//             lng: '$coordinates.longitude'
//           },
//           docs: { $push: '$$ROOT' },
//           count: { $sum: 1 }
//         }
//       },
//       {
//         $match: { count: { $gt: 1 } }
//       }
//     ];
    
//     const duplicateGroups = await Location.aggregate(pipeline);
//     let additionalDeleted = 0;
    
//     for (const group of duplicateGroups) {
//       // Keep only the latest document for each coordinate group
//       const sortedDocs = group.docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
//       const toDelete = sortedDocs.slice(1); // Remove all except the latest
      
//       for (const doc of toDelete) {
//         await Location.findByIdAndDelete(doc._id);
//         additionalDeleted++;
//         console.log(`🗑️ Removed duplicate: ${doc.coordinates.latitude}, ${doc.coordinates.longitude} at ${doc.timestamp}`);
//       }
//     }
    
//     const finalCount = await Location.countDocuments({ isActive: true });
//     const realUsersCount = await User.countDocuments({
//       'currentLocation.latitude': { $exists: true }
//     });
    
//     console.log(`🎉 CLEANUP COMPLETE!`);
//     console.log(`   - Deleted ${deletedCount} test/suspicious locations`);
//     console.log(`   - Deleted ${additionalDeleted} additional duplicates`);
//     console.log(`   - Updated ${usersUpdated} users' currentLocation`);
//     console.log(`   - Remaining ${finalCount} real locations`);
//     console.log(`   - ${realUsersCount} users with real location data`);
    
//     res.json({
//       success: true,
//       message: 'Aggressive cleanup completed',
//       deletedLocations: deletedCount + additionalDeleted,
//       updatedUsers: usersUpdated,
//       remainingLocations: finalCount,
//       usersWithRealData: realUsersCount
//     });
    
//   } catch (error) {
//     console.error('❌ Error during aggressive cleanup:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Clear all inactive employee location data
// router.delete('/clear-inactive', protect, hrOrAdmin, async (req, res) => {
//   try {
//     const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
//     // Find all users with inactive locations (older than 30 minutes) or no location at all
//     const usersWithInactiveLocations = await User.find({
//       $or: [
//         { 'currentLocation.lastUpdated': { $lt: thirtyMinutesAgo } },
//         { currentLocation: { $exists: false } },
//         { currentLocation: null }
//       ]
//     });
    
//     let deletedLocationCount = 0;
//     let clearedUserCount = 0;
    
//     // For inactive users, delete their location history AND clear their currentLocation
//     for (const user of usersWithInactiveLocations) {
//       // Delete all location history for this inactive user
//       const deleteResult = await Location.deleteMany({ userId: user._id });
//       deletedLocationCount += deleteResult.deletedCount;
      
//       // Clear current location from user profile
//       await User.findByIdAndUpdate(user._id, {
//         $unset: { currentLocation: 1 }
//       });
//       clearedUserCount++;
//     }
    
//     res.json({
//       success: true,
//       message: `Cleared ${deletedLocationCount} location records for ${clearedUserCount} inactive employees`,
//       deletedCount: deletedLocationCount,
//       clearedUsers: clearedUserCount
//     });
    
//   } catch (error) {
//     console.error('❌ Error clearing inactive data:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// export default router;


import express from 'express';
import {
  updateLocation,
  getCurrentLocation,
  getLocationHistory,
  getAllEmployeeLocations,
  clearAllLocationHistory
} from '../controllers/locationController.js';
import { protect, hrOrAdmin } from '../middleware/authMiddleware.js';
import Location from '../model/Location.js';
import User from '../model/User.js';

const router = express.Router();

// Employee routes
router.post('/update', protect, updateLocation);
router.get('/current', protect, getCurrentLocation);
router.get('/history', protect, getLocationHistory);

// HR/Admin routes - temporarily remove role restriction for debugging
router.get('/all-employees', protect, getAllEmployeeLocations);
router.delete('/clear-all', protect, hrOrAdmin, clearAllLocationHistory);

// Debug endpoint to check current user role
router.get('/debug-user', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        employeeId: req.user.employeeId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test endpoint to create sample location data
router.post('/test-create', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    
    // Create a test location record
    const testLocation = new Location({
      userId,
      coordinates: {
        latitude: 22.5726,
        longitude: 88.3639
      },
      address: "Test Address, Kolkata",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      accuracy: 10,
      timestamp: now,
      isActive: true
    });
    
    await testLocation.save();
    
    // Update user's current location
    await User.findByIdAndUpdate(userId, {
      currentLocation: {
        latitude: 22.5726,
        longitude: 88.3639,
        lastUpdated: now
      }
    });
    
    res.json({ message: 'Test location created', location: testLocation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to simulate location update with coordinate comparison
router.post('/test-update', protect, async (req, res) => {
  try {
    const { latitude, longitude, sameLocation = false } = req.body;
    
    let testLat, testLng;
    
    if (sameLocation) {
      // Use existing coordinates with minimal variation (should trigger overwrite)
      const lastLocation = await Location.findOne({ 
        userId: req.user._id, 
        isActive: true 
      }).sort({ timestamp: -1 });
      
      if (lastLocation) {
        testLat = lastLocation.coordinates.latitude + 0.00001; // Very small change (~1 meter)
        testLng = lastLocation.coordinates.longitude + 0.00001;
      } else {
        testLat = 22.5726;
        testLng = 88.3639;
      }
    } else {
      // Use provided coordinates or generate significantly different ones
      testLat = latitude || (22.5726 + (Math.random() - 0.5) * 0.01); // Larger variation (~500 meters)
      testLng = longitude || (88.3639 + (Math.random() - 0.5) * 0.01);
    }

    // Call the actual updateLocation endpoint
    const updateResponse = await fetch(`http://localhost:5000/api/location/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization
      },
      body: JSON.stringify({
        latitude: testLat,
        longitude: testLng,
        address: sameLocation ? 'Same Location Test' : 'Different Location Test',
        city: 'Kolkata',
        state: 'West Bengal',
        country: 'India',
        accuracy: 50
      })
    });

    const updateResult = await updateResponse.json();

    res.json({
      success: true,
      message: `Test update completed (${sameLocation ? 'same' : 'different'} location)`,
      result: updateResult,
      coordinates: { latitude: testLat, longitude: testLng },
      expectedBehavior: sameLocation ? 'Should overwrite existing record' : 'Should create new record'
    });

  } catch (error) {
    console.error('Error in test update:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cleanup endpoint to remove duplicate coordinates
router.post('/cleanup-duplicates', protect, async (req, res) => {
  try {
    console.log('🧹 Starting duplicate coordinates cleanup...');
    
    // Get all users
    const users = await User.find({}, '_id name');
    let totalCleaned = 0;
    
    for (const user of users) {
      console.log(`🔍 Processing user: ${user.name} (${user._id})`);
      
      // Get all locations for this user, sorted by timestamp
      const locations = await Location.find({ 
        userId: user._id, 
        isActive: true 
      }).sort({ timestamp: -1 });
      
      if (locations.length <= 1) {
        console.log(`   ✅ User has ${locations.length} location(s), skipping`);
        continue;
      }
      
      const coordinatePrecision = 0.0001; // Same as update logic
      const toDelete = [];
      const keepLatest = new Map(); // Map to store latest entry for each coordinate
      
      // First pass: identify the latest entry for each coordinate
      for (const location of locations) {
        const lat = Math.round(location.coordinates.latitude / coordinatePrecision) * coordinatePrecision;
        const lng = Math.round(location.coordinates.longitude / coordinatePrecision) * coordinatePrecision;
        const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        
        if (!keepLatest.has(coordKey) || new Date(location.timestamp) > new Date(keepLatest.get(coordKey).timestamp)) {
          // If we already had an entry for this coordinate, mark the old one for deletion
          if (keepLatest.has(coordKey)) {
            toDelete.push(keepLatest.get(coordKey)._id);
          }
          keepLatest.set(coordKey, location);
        } else {
          // This location is older than the one we're keeping
          toDelete.push(location._id);
        }
      }
      
      console.log(`   📊 Analysis: ${locations.length} total locations, ${keepLatest.size} unique coordinates, ${toDelete.length} duplicates to remove`);
      
      if (toDelete.length > 0) {
        await Location.deleteMany({ _id: { $in: toDelete } });
        totalCleaned += toDelete.length;
        console.log(`   🧹 Deleted ${toDelete.length} duplicate location(s) for ${user.name}`);
      }
    }
    
    console.log(`🎉 Cleanup complete! Removed ${totalCleaned} duplicate locations total.`);
    
    res.json({
      success: true,
      message: `Cleanup completed successfully`,
      totalCleaned,
      details: `Removed ${totalCleaned} duplicate location records`
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove all test/fake location data and keep only real coordinates
router.post('/clear-test-data', protect, async (req, res) => {
  try {
    console.log('🧹 Starting AGGRESSIVE test data cleanup...');
    
    // Get all locations to analyze
    const allLocations = await Location.find({ isActive: true });
    console.log(`📊 Total locations found: ${allLocations.length}`);
    
    // Define what we consider "test" data
    const testPatterns = [
      'Test Address',
      'Test Location', 
      'Same Location Test',
      'Different Location Test',
      'Test',
      'test'
    ];
    
    // Common test coordinates (exact matches)
    // const testCoordinates = [
    //   { lat: 22.5726, lng: 88.3639 },  // Main test coordinate
    //   { lat: 22.5726, lng: 88.3639 },  // Common test variations
    // ];
    
    let deletedCount = 0;
    
    for (const location of allLocations) {
      let isTestData = false;
      
      // Check 1: Address contains test keywords
      if (location.address) {
        const hasTestKeyword = testPatterns.some(pattern => 
          location.address.toLowerCase().includes(pattern.toLowerCase())
        );
        if (hasTestKeyword) {
          console.log(`🗑️ Test address found: ${location.address}`);
          isTestData = true;
        }
      }
      
      // Check 2: Exact test coordinates
      const isTestCoordinate = testCoordinates.some(testCoord => 
        Math.abs(location.coordinates.latitude - testCoord.lat) < 0.00001 &&
        Math.abs(location.coordinates.longitude - testCoord.lng) < 0.00001
      );
      if (isTestCoordinate) {
        console.log(`🗑️ Test coordinate found: ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
        isTestData = true;
      }
      
      // Check 3: Suspicious accuracy values
      if (location.accuracy === 0 || location.accuracy === 10 || location.accuracy === 50 || location.accuracy > 1000000) {
        console.log(`🗑️ Suspicious accuracy found: ${location.accuracy}`);
        isTestData = true;
      }
      
      // Check 4: Duplicate coordinates (keep only the latest for each coordinate)
      const duplicates = allLocations.filter(loc => 
        loc._id.toString() !== location._id.toString() &&
        Math.abs(loc.coordinates.latitude - location.coordinates.latitude) < 0.0001 &&
        Math.abs(loc.coordinates.longitude - location.coordinates.longitude) < 0.0001
      );
      
      if (duplicates.length > 0) {
        // Check if this is the latest entry for these coordinates
        const isLatest = duplicates.every(dup => 
          new Date(location.timestamp) >= new Date(dup.timestamp)
        );
        
        if (!isLatest) {
          console.log(`�️ Duplicate coordinate (older): ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
          isTestData = true;
        }
      }
      
      // Delete if identified as test data
      if (isTestData) {
        await Location.findByIdAndDelete(location._id);
        deletedCount++;
      }
    }
    
    console.log(`🗑️ Deleted ${deletedCount} test/duplicate location entries`);
    
    // Clean up user currentLocation with test data
    const users = await User.find({});
    let usersUpdated = 0;
    
    for (const user of users) {
      if (user.currentLocation) {
        const { latitude, longitude } = user.currentLocation;
        
        // Check if user's currentLocation is test data
        const isTestCurrentLocation = testCoordinates.some(testCoord => 
          Math.abs(latitude - testCoord.lat) < 0.00001 &&
          Math.abs(longitude - testCoord.lng) < 0.00001
        );
        
        if (isTestCurrentLocation) {
          // Find their latest REAL location
          const latestRealLocation = await Location.findOne({
            userId: user._id,
            isActive: true
          }).sort({ timestamp: -1 });
          
          if (latestRealLocation) {
            user.currentLocation = {
              latitude: latestRealLocation.coordinates.latitude,
              longitude: latestRealLocation.coordinates.longitude,
              lastUpdated: latestRealLocation.timestamp
            };
            console.log(`✅ Updated ${user.name}'s currentLocation to real coordinates`);
          } else {
            user.currentLocation = undefined;
            console.log(`🔄 Cleared ${user.name}'s currentLocation (no real data)`);
          }
          
          await user.save();
          usersUpdated++;
        }
      }
    }
    
    // Final cleanup: Remove any remaining exact duplicates
    const pipeline = [
      {
        $group: {
          _id: {
            userId: '$userId',
            lat: '$coordinates.latitude',
            lng: '$coordinates.longitude'
          },
          docs: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ];
    
    const duplicateGroups = await Location.aggregate(pipeline);
    let additionalDeleted = 0;
    
    for (const group of duplicateGroups) {
      // Keep only the latest document for each coordinate group
      const sortedDocs = group.docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const toDelete = sortedDocs.slice(1); // Remove all except the latest
      
      for (const doc of toDelete) {
        await Location.findByIdAndDelete(doc._id);
        additionalDeleted++;
        console.log(`🗑️ Removed duplicate: ${doc.coordinates.latitude}, ${doc.coordinates.longitude} at ${doc.timestamp}`);
      }
    }
    
    const finalCount = await Location.countDocuments({ isActive: true });
    const realUsersCount = await User.countDocuments({
      'currentLocation.latitude': { $exists: true }
    });
    
    console.log(`🎉 CLEANUP COMPLETE!`);
    console.log(`   - Deleted ${deletedCount} test/suspicious locations`);
    console.log(`   - Deleted ${additionalDeleted} additional duplicates`);
    console.log(`   - Updated ${usersUpdated} users' currentLocation`);
    console.log(`   - Remaining ${finalCount} real locations`);
    console.log(`   - ${realUsersCount} users with real location data`);
    
    res.json({
      success: true,
      message: 'Aggressive cleanup completed',
      deletedLocations: deletedCount + additionalDeleted,
      updatedUsers: usersUpdated,
      remainingLocations: finalCount,
      usersWithRealData: realUsersCount
    });
    
  } catch (error) {
    console.error('❌ Error during aggressive cleanup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear all inactive employee location data
router.delete('/clear-inactive', protect, hrOrAdmin, async (req, res) => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Find all users with inactive locations (older than 30 minutes) or no location at all
    const usersWithInactiveLocations = await User.find({
      $or: [
        { 'currentLocation.lastUpdated': { $lt: thirtyMinutesAgo } },
        { currentLocation: { $exists: false } },
        { currentLocation: null }
      ]
    });
    
    let deletedLocationCount = 0;
    let clearedUserCount = 0;
    
    // For inactive users, delete their location history AND clear their currentLocation
    for (const user of usersWithInactiveLocations) {
      // Delete all location history for this inactive user
      const deleteResult = await Location.deleteMany({ userId: user._id });
      deletedLocationCount += deleteResult.deletedCount;
      
      // Clear current location from user profile
      await User.findByIdAndUpdate(user._id, {
        $unset: { currentLocation: 1 }
      });
      clearedUserCount++;
    }
    
    res.json({
      success: true,
      message: `Cleared ${deletedLocationCount} location records for ${clearedUserCount} inactive employees`,
      deletedCount: deletedLocationCount,
      clearedUsers: clearedUserCount
    });
    
  } catch (error) {
    console.error('❌ Error clearing inactive data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
