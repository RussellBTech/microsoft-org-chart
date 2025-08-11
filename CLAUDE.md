# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Microsoft Org Chart Management Sandbox Tool - A React/TypeScript web application for visualizing and modifying organizational structures in a sandbox environment without affecting live Azure Active Directory data.

## Development Principles

Follow these core principles when working on this codebase:

- **KISS (Keep It Simple, Stupid)**: Favor simple, straightforward solutions over complex abstractions
- **DRY (Don't Repeat Yourself)**: Extract reusable logic into hooks, utilities, or components
- **YAGNI (You Aren't Gonna Need It)**: Build only what's needed for current requirements, avoid premature optimization
- **SOLID**: 
  - Single Responsibility: Each component/function should have one clear purpose
  - Open/Closed: Extend functionality through composition rather than modification
  - Liskov Substitution: Components should be replaceable with their subtypes
  - Interface Segregation: Keep interfaces focused and minimal
  - Dependency Inversion: Depend on abstractions (props/interfaces) not concrete implementations

## Common Development Commands

### Frontend (located in `/frontend` directory)
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

Note: Currently no backend implementation exists (empty `/backend` directory).

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React hooks with localStorage persistence

### Key Components and Data Flow

1. **App.tsx** - Main application controller that:
   - Manages global state (employees, scenarios, sandbox mode)
   - Coordinates between panels and modals
   - Handles employee updates and reassignments

2. **OrgChart Component** - Core visualization component that:
   - Builds hierarchical tree structure from flat employee data
   - Implements drag-and-drop for employee reassignment
   - Handles node collapsing/expanding
   - Manages zoom/pan controls
   - Shows performance warning for datasets > 5,000 employees

3. **Data Model** (mockData.ts):
   - `Employee`: id, name, title, department, email, managerId (nullable for CEO)
   - `Scenario`: saved organizational structure snapshots
   - Currently uses mock data - future integration with Microsoft Graph API planned

4. **Sandbox Mode Pattern**:
   - Read-only by default
   - Sandbox mode enables drag-and-drop reassignment and title editing
   - Changes are isolated until explicitly saved as scenarios
   - Scenarios persist in localStorage

### Component Communication
- Unidirectional data flow via props
- Modal components receive callbacks for state updates
- Search/filter state managed at App level and passed down
- Employee selection triggers modal display

### Performance Considerations
- Tree rendering uses recursive component approach
- Collapse/expand state managed per node
- Warning displayed for large datasets (> 5,000 nodes)
- Zoom scaling applied via CSS transforms

## Business Requirements Context

Per BRD specifications:
- Max tested capacity: 5,000 employees
- Performance targets: Initial load < 10s, TTI < 2.5s
- Export formats: JSON and PDF
- Role-based access control (admin, manager, assistant)
- No write-back to Azure AD in current phase