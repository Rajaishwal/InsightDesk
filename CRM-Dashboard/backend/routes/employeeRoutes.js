import express from 'express';
import { getEmployeeList } from '../controllers/employeeController.js';

const router = express.Router();
router.get('/list', getEmployeeList);

export default router;
