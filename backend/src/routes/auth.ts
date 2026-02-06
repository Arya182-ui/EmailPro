import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { registerSchema, loginSchema, validate } from '../utils/validation';
import { authRateLimit } from '../middleware/rateLimit';

const router = express.Router();
const prisma = new PrismaClient();

// Registration control (code-based)
const REGISTRATION_ENABLED = true; // Change this to false to disable registration
const REGISTRATION_MESSAGE = 'Registration is currently closed. Please contact administrator if you want to register.';

// Register
router.post('/register', authRateLimit, validate(registerSchema), async (req, res) => {
  try {
    // Simple code-based registration control
    if (!REGISTRATION_ENABLED) {
      return res.status(403).json({ 
        error: REGISTRATION_MESSAGE 
      });
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const jwtSecret = config.jwt.secret;
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }
    
    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', authRateLimit, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const jwtSecret = config.jwt.secret;
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }
    
    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/me', authRateLimit, async (req: any, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied' });
    }

    const jwtSecret = config.jwt.secret;
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;