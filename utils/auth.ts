import { Console } from 'console';
import jwt from 'jsonwebtoken';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { NextRequest } from 'next/server';

// Define the token payload interface
interface TokenPayload {
  id: string;
  email: string;
}

export async function getTokenData(req: Request): Promise<any> {
    const token = req.headers.get('cookie')?.split('token=')[1]?.split(';')[0];
    if (!token) return null;
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      return decoded;
    } catch (error) {
      return null;
    }
  }

// export function verifyToken(token: string): TokenPayload | null {
//     try {
//       console.log('JWT_SECRET used for verification:', process.env.JWT_SECRET);
//       console.log('Token length:', token.length);
//       console.log('Token first 10 chars:', token.substring(0, 10));
  
//       const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
      
//       console.log('Token verification successful', {
//         id: decoded.id,
//         email: decoded.email
//       });
  
//       return decoded;
//     } catch (error) {
//       console.error('Token Verification Error:', {
//         name: error.name,
//         message: error.message,
//         stack: error.stack
//       });
//       return null;
//     }
//   }

export async function verifyToken(token: string) {
    try {
      const encoder = new TextEncoder();
      const secretKey = encoder.encode(process.env.JWT_SECRET);
      
      const { payload } = await jwtVerify(token, secretKey);
      return payload;
    } catch (error) {
      console.error('Token Verification Error:', error);
      return null;
    }
  }