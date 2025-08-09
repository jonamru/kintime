const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export { JWT_SECRET as default };
export const JWT_SECRET_STRING: string = JWT_SECRET;