import * as walletRepository from '../repositories/walletRepository';
import { serialiseDecimals } from './helpers/serialise';
import { AppError } from './helpers/AppError';
import { Prisma } from 'prisma-client';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// ══════════════════════════════════════════════════════════════
// WALLET SERVICE
// ══════════════════════════════════════════════════════════════

/**
 * Get wallet balances for the authenticated user.
 * Computes availableBalance = balance - lockedBalance.
 * All Decimal fields are serialised to strings.
 */
export async function getWallet(userId: string) {
  const wallet = await walletRepository.findByUserId(userId);

  if (!wallet) {
    throw new AppError('Wallet not found', 404, 'NOT_FOUND');
  }

  const availableBalance = new Decimal(wallet.balance).minus(new Decimal(wallet.lockedBalance));

  const serialised = serialiseDecimals(wallet, [
    'balance',
    'lockedBalance',
    'totalDeposited',
    'totalWithdrawn',
  ]);

  return {
    ...serialised,
    availableBalance: availableBalance.toString(),
  };
}
