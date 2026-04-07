# Worship Song Sheet Management App - Design Guidelines

## Design Approach

**Selected System**: Material Design inspired approach with Google Drive aesthetic
**Justification**: Utility-focused file management application requiring efficient search, upload, and organization capabilities. Users need quick access to worship song sheets during service preparation.

**Key Design Principles**:
- Clarity over decoration - prioritize finding songs quickly
- Consistent patterns for file management
- Traditional Chinese typography excellence
- Spacious layouts for touch-friendly interactions

---

## Typography

**Primary Font**: Noto Sans TC (Google Fonts) - excellent Traditional Chinese support
**Hierarchy**:
- Page Headers: text-3xl font-bold (繁體中文 song titles)
- Section Headers: text-xl font-semibold
- Body Text: text-base font-normal
- Metadata/Labels: text-sm font-medium
- Helper Text: text-xs text-gray-600

---

## Layout System

**Spacing Units**: Use Tailwind units of **2, 4, 6, and 8** consistently
- Component padding: p-4 or p-6
- Section margins: mb-6 or mb-8
- Grid gaps: gap-4 or gap-6
- Container max-width: max-w-7xl

**Grid System**:
- Search results: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Admin dashboard: Two-column layout (sidebar + main content)
- Mobile-first responsive breakpoints

---

## Component Library

### Navigation
- **Top Bar**: Fixed header with logo, search bar, user menu
- **Sidebar (Admin)**: Collapsible navigation for inventory management
- Height: h-16 for top bar

### Search Interface
- **Prominent Search Bar**: Centered, width w-full md:w-2/3 lg:w-1/2
- **Advanced Filters**: Dropdown panels for composer, key, tempo, tags
- **Quick Tags**: Clickable chips below search for common categories
- Layout: Sticky search header (sticky top-16)

### Song Card Component
- **Card Structure**: Rounded borders, shadow on hover
- **Thumbnail Preview**: PDF first page preview (aspect-ratio-3/4)
- **Metadata Display**: Title (font-bold), composer, key, tempo icons
- **Action Buttons**: Download, view, share icons (Heroicons)
- **Multiple Versions Badge**: If multiple arrangements exist
- Padding: p-4, rounded-lg

### Upload Interface
- **Drag & Drop Zone**: Large, centered area with icon and instructions
- **File Browser Button**: Secondary action
- **Metadata Form**: Title, composer, key, tempo, tags inputs
- **Progress Indicator**: Linear progress bar during upload
- Form spacing: space-y-4

### Admin Dashboard
- **Data Table**: Song inventory with sortable columns
- **Action Menu**: Edit, delete, view versions dropdown
- **Bulk Actions**: Checkbox selection for multiple items
- **Stats Cards**: Total songs, recent uploads, user activity
- Table row height: h-12

### User Authentication
- **Login/Register Modal**: Centered overlay with Replit Auth
- **User Avatar Menu**: Top-right dropdown for profile/logout

---

## Animations

**Minimal Motion**:
- Card hover: translate-y-1 transition (very subtle lift)
- Button interactions: Native browser states only
- No page transitions or scroll animations

---

## Images

**No Hero Image**: This is a utility application, not a marketing site. Launch directly into the search interface.

**Content Images**:
- **Song Sheet Thumbnails**: Auto-generated PDF previews
- **Empty States**: Simple icon illustrations (e.g., musical note for no results)
- **User Avatars**: Circular profile images in header

---

## Page Layouts

### Main Search Page
1. **Fixed Header**: Logo + centered search bar + user menu (h-16)
2. **Filter Bar**: Advanced search options, collapsible (h-auto)
3. **Results Grid**: 3-column responsive card grid with song sheets
4. **Pagination**: Bottom-centered navigation

### Admin Dashboard
1. **Sidebar Navigation**: Fixed left panel (w-64), collapsible on mobile
2. **Main Content**: Stats overview + data table
3. **Action Modals**: Add/edit song overlays

### Upload Page
1. **Centered Upload Zone**: Large drag-drop area
2. **Metadata Form**: Below upload zone
3. **Preview Panel**: Shows uploaded file before submission

---

## Traditional Chinese Considerations

- Adequate line-height (leading-relaxed) for character readability
- Proper font weights - Chinese characters need sufficient weight
- Generous spacing between elements for touch targets
- Use Noto Sans TC for consistent rendering across devices

---

This design creates a professional, efficient worship song management system that prioritizes quick access and easy organization over visual flourishes.