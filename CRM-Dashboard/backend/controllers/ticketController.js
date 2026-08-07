import Ticket from '../model/Ticket.js';
import { getIo } from '../socket.js';

// POST /api/tickets — employee creates a ticket
export const createTicket = async (req, res) => {
  try {
    const { category, problem, priority, description, attachments } = req.body;
    if (!category || !description) {
      return res.status(400).json({ message: 'Category and description are required' });
    }

    const ticket = new Ticket({
      userId:         req.user._id,
      userName:       req.user.name,
      userEmail:      req.user.email,
      userEmployeeId: req.user.employeeId || '',
      category,
      problem:        problem || '',
      priority:       priority || 'Low',
      description,
      attachments:    Array.isArray(attachments) ? attachments : [],
    });

    await ticket.save();

    // Notify all admins via socket
    getIo()?.emit('ticket:new', {
      ticketId:   ticket.ticketId,
      userName:   ticket.userName,
      category:   ticket.category,
      priority:   ticket.priority,
    });

    res.status(201).json({ message: 'Ticket created successfully', ticket });
  } catch (err) {
    console.error('createTicket error:', err.message);
    res.status(500).json({ message: 'Failed to create ticket' });
  }
};

// GET /api/tickets/my — employee's own tickets
export const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};

// GET /api/tickets/all — admin: all tickets with optional filters
export const getAllTickets = async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    const query = {};
    if (status   && status   !== 'all') query.status   = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (category && category !== 'all') query.category = category;

    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};

// GET /api/tickets/:ticketId — single ticket with full replies
export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Employees can only view their own
    if (req.user.role !== 'admin' && ticket.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch ticket' });
  }
};

// POST /api/tickets/:ticketId/reply — add a reply
export const addReply = async (req, res) => {
  try {
    const { message, attachments } = req.body;
    if (!message?.trim() && (!Array.isArray(attachments) || attachments.length === 0)) {
      return res.status(400).json({ message: 'Reply must have a message or attachment' });
    }

    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Employees can only reply to their own tickets
    if (req.user.role !== 'admin' && ticket.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    ticket.replies.push({
      authorId:    req.user._id,
      authorName:  req.user.name,
      authorRole:  req.user.role,
      message:     message?.trim() || '',
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // Auto-reopen only on Resolved (not Closed — Closed is permanent)
    if (req.user.role !== 'admin' && ticket.status === 'Resolved') {
      ticket.status = 'Open';
    }

    await ticket.save();

    // Notify the ticket owner (if admin replied)
    if (req.user.role === 'admin') {
      getIo()?.to(ticket.userId.toString()).emit('ticket:reply', {
        ticketId:   ticket._id,
        ticketRef:  ticket.ticketId,
        authorName: req.user.name,
      });
    }

    res.json({ message: 'Reply added', ticket });
  } catch (err) {
    console.error('addReply error:', err.message);
    res.status(500).json({ message: 'Failed to add reply' });
  }
};

// PUT /api/tickets/:ticketId/status — admin updates status
export const updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Open', 'In Progress', 'Resolved', 'Closed'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.status === 'Closed') {
      return res.status(400).json({ message: 'Closed tickets cannot be reopened or changed.' });
    }

    ticket.status = status;
    await ticket.save();

    // Notify ticket owner
    getIo()?.to(ticket.userId.toString()).emit('ticket:statusUpdate', {
      ticketId:  ticket._id,
      ticketRef: ticket.ticketId,
      status,
    });

    res.json({ message: 'Status updated', ticket });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status' });
  }
};