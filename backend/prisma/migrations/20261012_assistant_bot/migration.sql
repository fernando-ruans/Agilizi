CREATE TABLE "assistant_threads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nova conversa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assistant_threads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "assistant_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "assistant_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "args" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assistant_actions_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "assistant_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "assistant_threads_companyId_idx" ON "assistant_threads"("companyId");
CREATE INDEX "assistant_messages_threadId_idx" ON "assistant_messages"("threadId");
CREATE INDEX "assistant_actions_threadId_idx" ON "assistant_actions"("threadId");
CREATE INDEX "assistant_actions_companyId_idx" ON "assistant_actions"("companyId");

