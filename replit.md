# 詩歌歌曲庫 (Worship Song Sheet Management System)

## Overview
This project is a web application for managing church worship song sheet music. It integrates with Google Drive for global search, dynamically created categories, multi-user upload, and comprehensive administrator functions for song and user management. The system supports Traditional Chinese, features a multi-tab full-screen viewer for worship teams, and enables public access to view-only files while securing upload, edit, and delete operations. The application streamlines the organization and accessibility of worship resources, with AI-powered tag generation to enhance song discoverability.

## User Preferences
I prefer the use of Traditional Chinese in the interface.
I want to prioritize the implementation of AI metadata extraction.
I expect the system to handle multiple file versions for each song (different arrangements, PDF, images).
I need the ability to select specific files before previewing.
I require a multi-tab viewer for easy switching between song files during worship.
I want the search functionality to default to searching all categories, with optional category filtering.
I want all song metadata fields to be displayed in search results, even when fields are empty (showing "未提供").

## System Architecture
The application employs a clear separation between frontend and backend.

**UI/UX Decisions:**
- The frontend uses React with Shadcn UI and Tailwind CSS for a modern, responsive design with a navy-teal-gold color scheme.
- **Enhanced Visual Design (2026-01):** Comprehensive UI beautification including:
  - Refined color palette with softer, more accessible tones and improved dark mode support
  - Enhanced shadows and depth with multi-layer shadow effects for better visual hierarchy
  - Smooth micro-animations and transitions for hover states and interactions
  - Responsive 4-column grid layout (xl:grid-cols-4) for improved large screen utilization
  - Modern card designs with subtle borders, backdrop blur effects, and elevated hover states
  - Improved loading states with animated spinners and empty state illustrations
  - Gradient text effects for page headers and branding elements
  - Consistent button styling with shadow effects and proper color hierarchies
- Features a multi-tab full-screen viewer with zoom controls (50%-200%), color-coded tabs, and keyboard shortcuts.
- Supports dual view modes (Grid and List) with quick switching and state retention.
- Smart file handling: single files open directly, multiple files trigger a selection dialog.
- All core functionalities are implemented with a Traditional Chinese interface.
- **Disclaimers and Copyright Notices (2026-01):**
  - Site-wide footer with full bilingual (Chinese/English) disclaimer covering personal use, copyright ownership, and licensing requirements
  - Compact copyright notice in the song viewer footer reminding users of authorized use restrictions

**Technical Implementations:**
- **Frontend:** React, TypeScript, Wouter, TanStack Query, Shadcn UI, Tailwind CSS, Vite.
- **Backend:** Node.js, Express.js.
- **Database:** PostgreSQL (Neon) with Drizzle ORM.
- **Authentication:** Local username/password using `passport-local` and `bcrypt` with PostgreSQL session storage.
- **Authorization:** Role-based access control (`public`, `uploader`, `admin`) enforced via middleware.
- **File Previews:** Backend proxy for Google Drive authentication and CORS with an LRU cache.
- **Smart Search Fallback:** Displays all songs in a category if a search yields no results.
- **Enterprise Sync Reliability:** Implements exponential backoff, concurrent sync protection, handles failures, and provides health monitoring.

**Feature Specifications:**
- **Song Management:** Supports multiple file versions per song with simplified metadata (title, category, bandAlbum, tags). Admins have full CRUD capabilities. Includes AI tag generation and band/album extraction from filenames.
- **Category Management:** Categories can be dynamically synced from Google Drive folder structures or manually created by admins. Manual categories are preserved during sync. Supports orphaned category detection and cleanup.
- **User Management:** Admins have full control over user accounts (creation, editing, deletion, role management).
- **Security:** Bcrypt hashing, database session storage, HTTPS-only cookies (production), and open redirect protection. Metadata protection ensures existing song metadata is never overwritten during sync.
- **Download Gating:** Download functionality requires authentication; viewing remains public.
- **Google Drive as Single Source of Truth:** All song files originate from Google Drive. Deleting a song from the interface only removes the database record; the actual Google Drive file is preserved. Songs will reappear on next sync if the Drive file still exists.
- **Shared Files Support:** The same Google Drive file can be associated with multiple songs across different categories (via Drive shortcuts or multi-parenting).

**System Design Choices:**
- **Google Drive Integration:** Dynamic syncing of categories, songs, and files (PDF, images) from a designated Google Drive folder structure, grouping similar files as different song versions. Supports Shared Drives.
- **Database Schema:** Tables for `users`, `categories`, `songs`, `files`, and `sync_status` with `categoryId` and `driveId` for Google Drive synchronization. Includes flags for manual categories and orphaned status.
- **API Endpoints:** Comprehensive CRUD operations for categories, songs, files, user authentication/authorization, and sync monitoring/triggering. Admin routes for AI features and category management.
- **Admin Interface:** Triple-tab system for song, category, and user management with a real-time sync status dashboard and manual override capability.

## External Dependencies
- **Google Drive API:** For dynamic folder structure synchronization, file scanning, and content preview.
- **PostgreSQL (Neon):** Primary database for application data.
- **Drizzle ORM:** For database interaction.
- **Passport.js:** For authentication and session management.
- **bcrypt:** For secure password hashing.
- **GPT-4o-mini (via Replit AI Integrations):** For AI-powered tag generation.
- **Google Cloud Vision API or Document AI (Planned):** For OCR text extraction.
- **Gemini 1.5 Flash or GPT-4o Mini (Planned):** For LLM-based structured metadata extraction.

## AI Tag Generation Guidelines
The AI tag generator uses the following approved tag categories:

**Allowed Tags:**
- 情感/氛圍類：敬畏、安靜、激昂、感恩、喜樂、平安、盼望、安慰、渴慕、親密
- 主題類：敬拜、讚美、禱告、認罪、奉獻、福音、十架、救恩、恩典、信心、愛、聖靈、醫治、更新、復興、委身、跟隨
- 功能/場合類：開場、回應、結束、聖餐、洗禮、差遣、宣告、默想
- 節期類：聖誕、復活節、受難節

**Forbidden Tags (not generated):**
- 語言相關（粵語、國語、英語）- cannot determine from song title
- 新舊風格（現代、傳統）- subjective and not relevant
- 音樂風格（流行、搖滾、民謠）- cannot determine from song title