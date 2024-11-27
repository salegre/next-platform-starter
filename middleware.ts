import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // List of paths that don't require authentication
  const publicPaths = ['/login', '/register', '/api/login', '/api/register'];

  // Check if the current path requires authentication
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // If no token and path requires auth, redirect to login
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token if present
  // if (token) {
  //   try {
  //     jwt.verify(token, process.env.JWT_SECRET!);
  //   } catch (error) {
  //     // Invalid token, clear cookie and redirect to login
  //     const response = NextResponse.redirect(new URL('/login', request.url));
  //     response.cookies.delete('token');
  //     return response;
  //   }
  // }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}