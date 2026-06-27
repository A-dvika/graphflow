# Professional DAG Graph Visualization Guide

## Overview

The new `ReleaseDagGraph` component provides a professional, enterprise-grade visualization of release pipelines using a Directed Acyclic Graph (DAG) layout. It displays deployment workflows with clear stage-based organization, individual job status indicators, and interactive job details.

## Component Features

### Visual Structure

The DAG graph is organized into **stages**, each containing multiple **jobs**:

- **Stage Cards**: Horizontal containers displaying stage number, name, and related jobs
- **Job Cards**: Individual task nodes within stages showing status, duration, and metadata
- **Connection Arrows**: Visual indicators between stages showing dependency links
- **Link Counter**: Display of the number of dependencies between stages

### Status Indicators

Each job displays its current status with color coding:

- **PASSED** (Green): ✓ Completed successfully
- **FAILED** (Red): ✗ Task failed, blocking downstream
- **RUNNING** (Blue): ⟳ Currently executing
- **PENDING** (Gray): Task waiting to run

### Job Card Information

Each job card displays:

```
┌─────────────────────────────┐
│ [STATUS ICON] STATUS  TIME  │
│ Job Name                    │
│ [Tag1] [Tag2] [Tag3]        │
│ 2 in                1 out    │
└─────────────────────────────┘
```

- **Status Badge**: Icon + text label (PASSED/FAILED/RUNNING/PENDING)
- **Duration**: Execution time in minutes
- **Tags**: Categorization (Quality, Security, Critical, Infrastructure)
- **I/O Metrics**: Number of incoming and outgoing dependencies

### Interactive Features

#### Job Selection

Click any job card to view detailed information:

```
┌──────────────────────────────────────┐
│ Job Details: [Job Name]        CLOSE │
├──────────────────────────────────────┤
│ Status    │ Duration │ Dependencies │ Unlocks │
│ PASSED    │ 7m       │ 1            │ 1       │
├──────────────────────────────────────┤
│ Tags: [Quality] [Critical]           │
└──────────────────────────────────────┘
```

The details panel shows:
- Current job status
- Execution duration
- Number of dependencies (incoming)
- Number of jobs this unlocks (outgoing)
- All associated tags

#### Hover Effects

- Job cards lift slightly on hover (`hover:-translate-y-0.5`)
- Shadow effects enhance interactivity
- Focus rings for accessibility

## Design Specifications

### Color Scheme

```
Status Colors:
├─ Success: #3fb950 (green)
├─ Error:   #f85149 (red)
├─ Pending: #58a6ff (blue)
└─ Secondary: #8b949e (gray)

Backgrounds:
├─ Surface: var(--surface)
├─ Background: var(--background)
├─ Border: var(--border)
└─ Borders: 2px for job cards, 1px for stage container
```

### Spacing

- **Stage Gap**: 2rem (32px)
- **Job Card Gap**: 0.75rem (12px)
- **Padding**: 1.5rem (24px) for stage containers, 1rem (16px) for job cards
- **Border Radius**: 0.5rem (8px)

### Typography

- **Stage Number**: Bold, small uppercase tracking
- **Stage Name**: Large, bold heading
- **Job Name**: Medium, bold text
- **Tags**: Small, medium weight
- **Metadata**: Extra small, secondary color

## Mock Data Structure

The component uses mock data organized as:

```typescript
interface Job {
  id: string;
  name: string;
  status: "passed" | "failed" | "running" | "pending";
  duration: string;
  tags: string[];
  inputs: number;    // Dependencies
  outputs: number;   // Jobs this unlocks
}

interface Stage {
  id: string;
  name: string;
  number: number;
  jobs: Job[];
}

interface DependencyLink {
  from: string;  // Job ID
  to: string;    // Job ID
}
```

## Example Pipeline

### Stage 1: Build
- **Build** (PASSED, 4m)
  - Tags: Compute, Critical
  - Dependencies: 0, Unlocks: 2

### Stage 2: Risk Checks
- **Unit Tests** (PASSED, 7m)
  - Tags: Quality
  - Dependencies: 1, Unlocks: 1

- **Security Scan** (FAILED, 9m)
  - Tags: Security, Critical
  - Dependencies: 1, Unlocks: 1

### Stage 3: Deployment
- **Deploy Staging** (PENDING, -)
  - Tags: Infrastructure
  - Dependencies: 2, Unlocks: 1

- **Deploy Production** (PENDING, -)
  - Tags: Infrastructure, Critical
  - Dependencies: 1, Unlocks: 0

## Integration Notes

- Component is location-independent and can be placed anywhere
- Uses mock data for demonstration (can be connected to real API)
- Fully responsive with horizontal scrolling for mobile
- Accessible with keyboard navigation and focus management
- No external dependencies beyond lucide-react for icons

## Customization

### Changing Status Colors

Edit the `getStatusColor()` function in `release-dag-graph.tsx`:

```typescript
function getStatusColor(status: string) {
  switch (status) {
    case "passed":
      return {
        border: "border-[var(--status-success)]",
        bg: "bg-[var(--status-success)]/5",
        text: "text-[var(--status-success)]",
      };
    // ... more cases
  }
}
```

### Adding New Stages or Jobs

Update the `mockStages` array:

```typescript
const mockStages: Stage[] = [
  {
    id: "stage-1",
    name: "New Stage",
    number: 1,
    jobs: [
      {
        id: "job-1",
        name: "New Job",
        status: "passed",
        duration: "5m",
        tags: ["NewTag"],
        inputs: 0,
        outputs: 1,
      },
    ],
  },
];
```

## Performance Considerations

- Horizontal scrolling prevents layout shifts
- Inline-flex layout for efficient rendering
- Minimal re-renders with React hooks
- CSS transitions for smooth animations
- No heavy DOM manipulation

## Accessibility

- Keyboard navigation via Tab key
- Focus indicators on interactive elements
- ARIA attributes for semantic meaning
- Color contrast meets WCAG AA standards
- Alt text for status icons via titles

## Future Enhancements

- Connect to real API data
- Animated progress bars for running jobs
- Drill-down capability to view job logs
- Export pipeline as image/PDF
- Timeline view with execution history
- Custom filtering and search
- Dependency topology analysis
