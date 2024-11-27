import { jwtVerify, SignJWT } from 'jose';

interface TokenPayload {
 id: string;
 email: string;
 [key: string]: string | number; // Allow additional JWT payload properties
}

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
const alg = 'HS256';

export async function getTokenData(req: Request): Promise<TokenPayload | null> {
 const token = req.headers.get('cookie')?.split('token=')[1]?.split(';')[0];
 if (!token) return null;

 try {
   const { payload } = await jwtVerify(token, secretKey);
   return payload as TokenPayload;
 } catch (error) {
   return null;
 }
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
 try {
   const { payload } = await jwtVerify(token, secretKey);
   return payload as TokenPayload;
 } catch (error) {
   console.error('Token Verification Error:', error);
   return null;
 }
}

export async function generateToken(payload: TokenPayload): Promise<string> {
 const token = await new SignJWT(payload)
   .setProtectedHeader({ alg })
   .setIssuedAt()
   .setExpirationTime('24h')
   .sign(secretKey);
 return token;
}