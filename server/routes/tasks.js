import express from 'express';
import { db } from '../db.js';

const router = express.Router();

function normalizePriority(pri) {
  if (typeof pri === 'number') return Math.max(0, Math.min(3, pri));
  if (pri === 'urgent') return 3;
  if (pri === 'high') return 2;
  if (pri === 'low') return 0;
  return 1; // default Medium
}

// GET all tasks with optional ?filter=pending|all|done and ?sort=manual|due|pri
router.get('/', (req, res) => {
  let tasks = [...(db.get('tasks') || [])];
  const { filter = 'all', sort = 'manual' } = req.query;

  // Filter
  if (filter === 'pending') {
    tasks = tasks.filter(t => !t.completed);
  } else if (filter === 'done') {
    tasks = tasks.filter(t => t.completed);
  }

  // Sort
  if (sort === 'due') {
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return (a.sortOrder || 0) - (b.sortOrder || 0);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  } else if (sort === 'pri') {
    tasks.sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));
  } else {
    // Manual order
    tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  res.json(tasks);
});

// Create new task with idempotency
router.post('/', (req, res) => {
  const requestId = req.headers['x-request-id'];
  const cached = db.checkIdempotency(requestId);
  if (cached) return res.json(cached);

  const {
    title,
    notes = '',
    description = '',
    priority = 1,
    category = 'Work',
    dueDate = '',
    reminderLead = 'none',
    estimatedSessions = 1
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const tasks = db.get('tasks') || [];
  const maxSortOrder = tasks.reduce((max, t) => Math.max(max, t.sortOrder || 0), -1);

  const newTask = {
    id: 'task_' + Date.now(),
    title: title.trim(),
    notes: (notes || description || '').trim(),
    category: (category || 'Work').trim(),
    priority: normalizePriority(priority),
    dueDate: dueDate || '',
    reminderLead: reminderLead || 'none',
    estimatedSessions: Math.max(1, parseInt(estimatedSessions, 10) || 1),
    completedSessions: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: maxSortOrder + 1
  };

  tasks.push(newTask);
  db.set('tasks', tasks);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', tasks);
  }

  const responseData = { success: true, task: newTask };
  db.setIdempotency(requestId, responseData);
  res.json(responseData);
});

// Reorder tasks
router.put('/reorder', (req, res) => {
  const ids = req.body.taskIds || req.body.orderedIds;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'taskIds or orderedIds array is required' });
  }
  const taskIds = ids;

  const tasks = db.get('tasks') || [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const reordered = [];
  taskIds.forEach((id, index) => {
    if (taskMap.has(id)) {
      const task = taskMap.get(id);
      task.sortOrder = index;
      task.updatedAt = new Date().toISOString();
      reordered.push(task);
      taskMap.delete(id);
    }
  });

  // Append any tasks not in the list at the end
  let remainingIndex = reordered.length;
  taskMap.forEach(task => {
    task.sortOrder = remainingIndex++;
    reordered.push(task);
  });

  db.set('tasks', reordered);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('TASKS_UPDATED', reordered);
  }

  res.json({ success: true, tasks: reordered });
});

// Update task
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    title,
    notes,
    description,
    completed,
    priority,
    category,
    dueDate,
    reminderLead,
    estimatedSessions,
    completedSessions
  } = req.body;

  const tasks = db.get('tasks') || [];
  const index = tasks.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (title !== undefined) tasks[index].title = title.trim();
  if (notes !== undefined) tasks[index].notes = notes.trim();
  if (description !== undefined && notes === undefined) tasks[index].notes = description.trim();
  if (completed !== undefined) tasks[index].completed = !!completed;
  if (priority !== undefined) tasks[index].priority = normalizePriority(priority);
  if (category !== undefined) tasks[index].category = category.trim();
  if (dueDate !== undefined) tasks[index].dueDate = dueDate;
  if (reminderLead !== undefined) tasks[index].reminderLead = reminderLead;
  if (estimatedSessions !== undefined) tasks[index].estimatedSessions = Math.max(1, parseInt(estimatedSessions, 10) || 1);
  if (completedSessions !== undefined) tasks[index].completedSessions = Math.max(0, parseInt(completedSessions, 10) || 0);
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

  // If deleted task was the active focus target, clear it
  const focusState = db.get('focusState');
  if (focusState && focusState.currentTaskId === id) {
    focusState.currentTaskId = null;
    db.set('focusState', focusState);
    if (req.app.get('wssBroadcast')) {
      req.app.get('wssBroadcast')('FOCUS_UPDATED', focusState);
    }
  }

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
