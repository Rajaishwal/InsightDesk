import express from 'express';
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  addReply,
  updateTicketStatus,
} from '../controllers/ticketController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/',                        protect, createTicket);
router.get('/my',                       protect, getMyTickets);
router.get('/all',                      protect, admin, getAllTickets);        // admin only
router.post('/:ticketId/reply',         protect, addReply);
router.put('/:ticketId/status',         protect, admin, updateTicketStatus);   // admin only

export default router;