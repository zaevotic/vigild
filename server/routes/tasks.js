import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Get all tasks
router.get('/', (req, res) => {
  const tasks = db.get('tasks') || [];
  res.json(tasks);
});

// Create new task
router.post('/', (req, res) => {
  const { title, description = '', priority = 'medium', category = 'GENERAL', dueDate = '' } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const tasks = db.get('tasks') || [];
  const newTask = {
    id: 'task_' + Date.now(),
    title: title.trim(),
    description: description.trim(),
    completed: false,
    priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
    category: (category || 'GENERAL').trim().toUpperCase(),
    dueDate: dueDate || '',
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  db.set('tasks', tasks);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', tasks);
  }

  res.json({ success: true, task: newTask });
});

// Update task
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, completed, priority, category, dueDate } = req.body;

  const tasks = db.get('tasks') || [];
  const index = tasks.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (title !== undefined) tasks[index].title = title.trim();
  if (description !== undefined) tasks[index].description = description.trim();
  if (completed !== undefined) tasks[index].completed = !!completed;
  if (priority !== undefined) tasks[index].priority = priority;
  if (category !== undefined) tasks[index].category = (category || 'GENERAL').trim().toUpperCase();
  if (dueDate !== undefined) tasks[index].dueDate = dueDate;
  tasks[index].updatedAt = new Date().toISOString();

  db.set('tasks', tasks);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', tasks);
  }

  res.json({ success: true, task: tasks[index] });
});

// Toggle task completion
router.patch('/:id/toggle', (req, res) => {
  const { id } = req.params;
  const tasks = db.get('tasks') || [];
  const index = tasks.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks[index].completed = !tasks[index].completed;
  tasks[index].updatedAt = new Date().toISOString();

  db.set('tasks', tasks);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', tasks);
  }

  res.json({ success: true, task: tasks[index] });
});

// Delete single task
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const tasks = db.get('tasks') || [];
  const updatedTasks = tasks.filter(t => t.id !== id);

  db.set('tasks', updatedTasks);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', updatedTasks);
  }

  res.json({ success: true, id });
});

// Clear all completed tasks
router.post('/clear-completed', (req, res) => {
  const tasks = db.get('tasks') || [];
  const updatedTasks = tasks.filter(t => !t.completed);

  db.set('tasks', updatedTasks);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', updatedTasks);
  }

  res.json({ success: true, remainingCount: updatedTasks.length });
});

export default router;
