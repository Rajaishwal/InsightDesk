// Employee controller for search list
import User from '../model/User.js';

export async function getEmployeeList(req, res) {
  try {
    const users = await User.find({ role: 'employee' }, { _id: 0, employeeId: 1, name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee list' });
  }
}
