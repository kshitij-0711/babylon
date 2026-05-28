-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketCategory" AS ENUM ('POLITICS', 'SPORTS', 'TECHNOLOGY', 'SCIENCE', 'ENTERTAINMENT', 'FINANCE', 'WORLD_EVENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PARTIAL', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'ORDER_DEBIT', 'ORDER_CREDIT', 'TRADE_PAYOUT', 'REFUND', 'FEE');

-- CreateEnum
CREATE TYPE "ResolutionOutcome" AS ENUM ('YES', 'NO', 'VOID');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 1000.00,
    "locked_balance" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "total_deposited" DECIMAL(18,2) NOT NULL DEFAULT 1000.00,
    "total_withdrawn" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MarketCategory" NOT NULL DEFAULT 'OTHER',
    "image_url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "yes_price" DECIMAL(5,4) NOT NULL DEFAULT 0.50,
    "no_price" DECIMAL(5,4) NOT NULL DEFAULT 0.50,
    "total_volume" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "total_shares" INTEGER NOT NULL DEFAULT 0,
    "open_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "close_at" TIMESTAMP(3) NOT NULL,
    "resolve_at" TIMESTAMP(3),
    "outcome" "ResolutionOutcome",
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL,
    "filled_qty" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(5,4) NOT NULL,
    "avg_fill_price" DECIMAL(5,4),
    "total_cost" DECIMAL(18,2) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "filled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "buy_order_id" TEXT NOT NULL,
    "sell_order_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(5,4) NOT NULL,
    "total_value" DECIMAL(18,2) NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "avg_cost" DECIMAL(5,4) NOT NULL DEFAULT 0.00,
    "total_invested" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "realised_pnl" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "price" DECIMAL(5,4) NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "outcome" "ResolutionOutcome" NOT NULL,
    "evidence_url" TEXT,
    "notes" TEXT,
    "total_payout" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "winners_count" INTEGER NOT NULL DEFAULT 0,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" TEXT NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balance_after" DECIMAL(18,2) NOT NULL,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trader_stats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "winning_trades" INTEGER NOT NULL DEFAULT 0,
    "losing_trades" INTEGER NOT NULL DEFAULT 0,
    "total_profit" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "total_loss" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "net_pnl" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "roi" DECIMAL(8,4) NOT NULL DEFAULT 0.00,
    "markets_traded" INTEGER NOT NULL DEFAULT 0,
    "markets_created" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "markets_status_idx" ON "markets"("status");

-- CreateIndex
CREATE INDEX "markets_category_idx" ON "markets"("category");

-- CreateIndex
CREATE INDEX "markets_close_at_idx" ON "markets"("close_at");

-- CreateIndex
CREATE INDEX "markets_creator_id_idx" ON "markets"("creator_id");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_market_id_idx" ON "orders"("market_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_market_id_side_status_price_idx" ON "orders"("market_id", "side", "status", "price");

-- CreateIndex
CREATE INDEX "trades_market_id_idx" ON "trades"("market_id");

-- CreateIndex
CREATE INDEX "trades_executed_at_idx" ON "trades"("executed_at");

-- CreateIndex
CREATE INDEX "positions_user_id_idx" ON "positions"("user_id");

-- CreateIndex
CREATE INDEX "positions_market_id_idx" ON "positions"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_user_id_market_id_side_key" ON "positions"("user_id", "market_id", "side");

-- CreateIndex
CREATE INDEX "price_history_market_id_side_timestamp_idx" ON "price_history"("market_id", "side", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_market_id_key" ON "resolutions"("market_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_reference_id_idx" ON "transactions"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "trader_stats_user_id_key" ON "trader_stats"("user_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buy_order_id_fkey" FOREIGN KEY ("buy_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_sell_order_id_fkey" FOREIGN KEY ("sell_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trader_stats" ADD CONSTRAINT "trader_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
