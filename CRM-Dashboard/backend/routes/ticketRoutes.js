import express from 'express';
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  addReply,
  updateTicketStatus,
} from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/',                        protect, createTicket);
router.get('/my',                       protect, getMyTickets);
router.get('/all',                      protect, getAllTickets);
router.get('/:ticketId',                protect, getTicketById);
router.post('/:ticketId/reply',         protect, addReply);
router.put('/:ticketId/status',         protect, updateTicketStatus);

export default router;