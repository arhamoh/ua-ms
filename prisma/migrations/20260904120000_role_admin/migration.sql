-- New ADMIN role (near-super access, no Letters).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN' AFTER 'SUPER_ADMIN';
