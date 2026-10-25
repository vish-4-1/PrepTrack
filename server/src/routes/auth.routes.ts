import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { loginSchema, registerSchema } from '../validators';
import { env } from '../config/env';

const router = Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(validated.password, 10);
    const username = validated.email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        password: hashedPassword,
        role: validated.role || 'STUDENT',
        department: validated.department || 'Computer Science & Engineering',
        branch: validated.branch || 'B.Tech CSE',
        passoutYear: validated.passoutYear || 2027,
        studentProfile: {
          create: {
            username,
            placementReadiness: 65,
            targetRole: 'Software Development Engineer',
            summary: 'Onboarding in progress. Connect online profiles to calculate readiness.',
          },
        },
      },
      include: {
        studentProfile: true,
      },
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        studentProfileId: user.studentProfile?.id,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentProfileId: user.studentProfile?.id,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (err: any) {
    if (err.errors) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      include: { studentProfile: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(validated.password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        studentProfileId: user.studentProfile?.id,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentProfileId: user.studentProfile?.id,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (err: any) {
    if (err.errors) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
