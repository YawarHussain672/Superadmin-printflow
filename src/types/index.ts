// Enums (will be replaced by Prisma client after generation)
export enum UserRole {
  ADMIN = 'ADMIN',
  POC = 'POC',
  CLIENT = 'CLIENT'
}

export enum ProjectStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PRINTING = 'PRINTING',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum FileType {
  PO = 'PO',
  CHALLAN = 'CHALLAN',
  INVOICE = 'INVOICE'
}

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  active: boolean
}

export interface Project {
  id: string
  projectId: string
  name: string
  piNumber?: string
  piGeneratedAt?: Date
  piPdfUrl?: string
  piStatus?: string
  piVerifiedAt?: Date
  piVerifiedBy?: string
  location: string
  state?: string
  deliveryDate: Date
  status: ProjectStatus
  totalCost: number
  instructions?: string
  paymentCaptured?: boolean
  paymentCapturedAt?: Date
  paymentTxnId?: string
  paymentCapturedBy?: string
  paymentNotes?: string
  paymentReceiptUrl?: string | null
  paymentReceiptFilename?: string | null
  createdAt: Date
  updatedAt: Date
  pocId: string
  poc?: User
  collaterals?: Collateral[]
  statusHistory?: StatusHistory[]
  files?: FileUpload[]
  approval?: Approval
  dispatch?: Dispatch
}

export interface Collateral {
  id: string
  projectId: string
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  specification?: string
}

export interface StatusHistory {
  id: string
  projectId: string
  status: ProjectStatus
  note?: string
  timestamp: Date
}

export interface FileUpload {
  id: string
  projectId: string
  type: FileType
  url: string
  filename: string
  size?: number
  uploadedAt: Date
}

export interface Approval {
  id: string
  projectId: string
  status: ApprovalStatus
  requestedById: string
  requestedBy?: User
  approvedById?: string
  approvedAt?: Date
  rejectedAt?: Date
  notes?: string
  reminderCount: number
}

export interface Dispatch {
  id: string
  projectId: string
  courier: string
  trackingId: string
  trackingUrl?: string
  dispatchDate?: Date
  expectedDelivery?: Date
  actualDelivery?: Date
  status: string
  podUrl?: string
  notes?: string
}

export interface RateCard {
  id: string
  itemName: string
  specification: string
  volumeSlabs: VolumeSlab[]
  active: boolean
}

export interface VolumeSlab {
  slab: string
  price: number
}

export interface TeamMember {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  active: boolean
  joinedDate: Date
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  link?: string
  createdAt: Date
}

export interface Activity {
  id: string
  userId: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
  createdAt: Date
  user?: User
}

export interface ProjectStats {
  activeProjects: number
  pendingApproval: number
  inProduction: number
  inTransit: number
  delivered: number
  totalSpend: number
}

export interface LocationStats {
  location: string
  count: number
  spend: number
}
