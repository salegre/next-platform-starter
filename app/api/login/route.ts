import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectMongoDB from 'utils/mongodb-connection';
import { User } from 'models/User';

export async function POST(request: NextRequest) {
  console.log('Login route hit'); // Initial log

  
  
  await connectMongoDB();

  try {
    const body = await request.json();
    console.log('Request body:', body); // Log the incoming body

    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json({ 
        error: 'Email and password are required' 
      }, { status: 400 });
    }

    // Find user
    const user = await User.findOne({ email });
    console.log('User found:', user); // Log the found user

    if (!user) {
      console.log('No user found with this email');
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch); // Log password comparison result

    if (!isMatch) {
      console.log('Password does not match');
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    // Remove password from response
    const userResponse = {
      _id: user._id,
      email: user.email
    };

    

    // Set token in HTTP-only cookie
    const response = NextResponse.json(userResponse, { status: 200 });
response.headers.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
response.headers.set('Access-Control-Allow-Credentials', 'true');

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 1 day
    });
    console.log(response);
    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'Login failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}