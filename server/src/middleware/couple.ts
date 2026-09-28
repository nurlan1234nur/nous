import type { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      coupleId?: string;
    }
  }
}

// Хэрэглэгч хосд харьяалагдаж байгаа эсэхийг шалгаж req.coupleId-г онооно.
// Энэ нь бусад хосын датад хүрэхээс хамгаална.
// asyncHandler-оор ороосон — DB алдаа гарвал error middleware руу очно (unhandled rejection биш).
export const requireCouple = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = await User.findById(req.userId).select('couple');
  if (!user?.couple) {
    res.status(403).json({ error: 'Та эхлээд хосоо холбоно уу' });
    return;
  }
  req.coupleId = user.couple.toString();
  next();
});
