import { BRANCH_LOCATIONS, getStateForCity } from "@/lib/branch-locations"

export interface DeliveryAddressInput {
  location?: string | null
  state?: string | null
  branch?: string | null
  pocName?: string | null
  recipientName?: string | null
  recipientContact?: string | null
  recipientBranch?: string | null
  deliveryAddress?: string | null
  poc?: {
    id?: string
    name?: string | null
    email?: string | null
    phone?: string | null
    role?: string
    location?: string | null
    branch?: string | null
  } | null
}

export interface FormattedDeliveryAddress {
  isCustom: boolean
  singleLine: string
  lines: string[]
  name?: string | null
  contact?: string | null
  addressText: string
}

export function buildBranchAddress(
  branchStr: string | null | undefined,
  locationStr: string | null | undefined,
  stateStr?: string | null
): string {
  const branch = branchStr?.trim() || ""
  let location = locationStr?.trim() || "Gurugram"
  let state = stateStr?.trim() || ""

  if (location && (!state || state.toLowerCase() === location.toLowerCase())) {
    const fetchedState = getStateForCity(location)
    if (fetchedState) {
      state = fetchedState
    } else if (location === "Gurugram") {
      state = "Haryana"
    }
  }

  let cleanBranch = branch
  if (cleanBranch.toLowerCase().startsWith("axis max life insurance,")) {
    cleanBranch = cleanBranch.substring(24).trim()
  } else if (cleanBranch.toLowerCase().startsWith("axis max,")) {
    cleanBranch = cleanBranch.substring(9).trim()
  }

  let addr = cleanBranch
  if (location && !addr.toLowerCase().includes(location.toLowerCase())) {
    addr = addr ? `${addr}, ${location}` : location
  }
  if (state && !addr.toLowerCase().includes(state.toLowerCase())) {
    addr = `${addr}, ${state}`
  }
  if (!addr.toLowerCase().endsWith("india")) {
    addr = `${addr}, India`
  }

  return addr
}

export function buildFullAddress(
  branchStr: string | null | undefined,
  locationStr: string | null | undefined,
  stateStr?: string | null
): string {
  const branchAddr = buildBranchAddress(branchStr, locationStr, stateStr)
  if (branchAddr.toLowerCase().startsWith("axis max")) {
    return branchAddr
  }
  return `Axis Max Life Insurance, ${branchAddr}`
}

export function formatCustomAddress(customAddress: string): string {
  let addr = customAddress.trim()
  if (!addr) return ""

  if (addr.toLowerCase().startsWith("axis max")) {
    return addr
  }

  const stateFromCity = getStateForCity(addr)
  if (stateFromCity && !addr.toLowerCase().includes(stateFromCity.toLowerCase())) {
    if (addr.toLowerCase().endsWith(", india")) {
      addr = addr.substring(0, addr.length - 7).trim()
    } else if (addr.toLowerCase().endsWith("india")) {
      addr = addr.substring(0, addr.length - 5).trim()
    }
    addr = `${addr}, ${stateFromCity}`
  }

  if (!addr.toLowerCase().endsWith("india")) {
    addr = `${addr}, India`
  }

  return addr
}

export function formatDeliveryAddress(project: DeliveryAddressInput): FormattedDeliveryAddress {
  const recipientName = project.recipientName?.trim()
  const recipientContact = project.recipientContact?.trim()
  const recipientBranch = project.recipientBranch?.trim()

  const hasCustomRecipient = Boolean(recipientName || recipientContact || recipientBranch)

  const targetPocName = project.poc?.name || project.pocName || ""
  const isPocRecipient = Boolean(
    recipientName &&
    targetPocName &&
    recipientName.trim().toLowerCase() === targetPocName.trim().toLowerCase()
  )

  const rawLocation = (isPocRecipient && project.poc?.location)
    ? project.poc.location
    : (project.location && project.location !== "Delhi" ? project.location : (project.poc?.location || "Gurugram"))

  const effectiveLocation = rawLocation.trim() || "Gurugram"
  const effectiveState = getStateForCity(effectiveLocation) || (project.state && project.state !== project.location && project.state !== "Delhi" ? project.state : "Haryana")

  const defaultAddress = buildFullAddress(project.branch, effectiveLocation, effectiveState)

  let fullRecipientAddress = ""
  if (isPocRecipient) {
    fullRecipientAddress = buildFullAddress(recipientBranch || project.branch, effectiveLocation, effectiveState)
  } else if (recipientBranch) {
    fullRecipientAddress = formatCustomAddress(recipientBranch)
  } else {
    fullRecipientAddress = defaultAddress
  }

  if (!hasCustomRecipient) {
    return {
      isCustom: false,
      singleLine: defaultAddress,
      lines: [defaultAddress],
      addressText: defaultAddress,
    }
  }

  const lines: string[] = []
  if (recipientName) {
    lines.push(`Name: ${recipientName}`)
  }
  if (recipientContact) {
    lines.push(`Contact: ${recipientContact}`)
  }
  lines.push(`Address: ${fullRecipientAddress}`)

  return {
    isCustom: true,
    singleLine: [recipientName, recipientContact, fullRecipientAddress].filter(Boolean).join(" | "),
    lines,
    name: recipientName || null,
    contact: recipientContact || null,
    addressText: fullRecipientAddress,
  }
}
