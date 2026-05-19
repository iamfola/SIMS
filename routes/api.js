const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getStudentsByClassId } = require('../models/db');

router.get('/students/:classId', isAuthenticated, async (req, res) => {
  try {
    const students = await getStudentsByClassId(req.params.classId);
    res.json(students);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router;
