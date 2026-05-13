export const BRANCH_LOCATIONS: Record<string, { state: string; branches: string[] }> = {
  Ahmedabad: {
    state: "Gujarat",
    branches: ["Main Branch", "CG Road Branch", "Navrangpura Branch", "Satellite Branch"],
  },
  Bangalore: {
    state: "Karnataka",
    branches: ["Main Branch", "Koramangala Branch", "Indiranagar Branch", "Whitefield Branch"],
  },
  Bhopal: {
    state: "Madhya Pradesh",
    branches: ["Main Branch", "MP Nagar Branch", "Arera Colony Branch"],
  },
  Bhubaneswar: {
    state: "Odisha",
    branches: ["Main Branch", "Sahid Nagar Branch", "Jaydev Vihar Branch"],
  },
  Chandigarh: {
    state: "Chandigarh",
    branches: ["Main Branch", "Sector 17 Branch", "Sector 22 Branch"],
  },
  Chennai: {
    state: "Tamil Nadu",
    branches: ["Main Branch", "Anna Nagar Branch", "T Nagar Branch", "Adyar Branch"],
  },
  Coimbatore: {
    state: "Tamil Nadu",
    branches: ["Main Branch", "RS Puram Branch", "Gandhipuram Branch"],
  },
  Delhi: {
    state: "Delhi",
    branches: ["Main Branch", "Connaught Place Branch", "Rohini Branch", "Dwarka Branch"],
  },
  Faridabad: {
    state: "Haryana",
    branches: ["Main Branch", "Sector 15 Branch", "Sector 16 Branch"],
  },
  Ghaziabad: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Indirapuram Branch", "Raj Nagar Branch"],
  },
  Gurgaon: {
    state: "Haryana",
    branches: ["Main Branch", "Sector 14 Branch", "Sector 29 Branch", "DLF Phase 1 Branch"],
  },
  Hyderabad: {
    state: "Telangana",
    branches: ["Main Branch", "Banjara Hills Branch", "Jubilee Hills Branch", "Madhapur Branch"],
  },
  Indore: {
    state: "Madhya Pradesh",
    branches: ["Main Branch", "Vijay Nagar Branch", "Palasia Branch"],
  },
  Jaipur: {
    state: "Rajasthan",
    branches: ["Main Branch", "MI Road Branch", "Vaishali Nagar Branch", "Malviya Nagar Branch"],
  },
  Kanpur: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Swaroop Nagar Branch", "Civil Lines Branch"],
  },
  Kochi: {
    state: "Kerala",
    branches: ["Main Branch", "MG Road Branch", "Kadavanthra Branch"],
  },
  Kolkata: {
    state: "West Bengal",
    branches: ["Main Branch", "Park Street Branch", "Salt Lake Branch", "Howrah Branch"],
  },
  Lucknow: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Hazratganj Branch", "Gomti Nagar Branch"],
  },
  Ludhiana: {
    state: "Punjab",
    branches: ["Main Branch", "Model Town Branch", "Sarabha Nagar Branch"],
  },
  Madurai: {
    state: "Tamil Nadu",
    branches: ["Main Branch", "KK Nagar Branch", "Anna Nagar Branch"],
  },
  Mumbai: {
    state: "Maharashtra",
    branches: ["Main Branch", "Andheri Branch", "Borivali Branch", "Bandra Branch", "Dadar Branch"],
  },
  Mysore: {
    state: "Karnataka",
    branches: ["Main Branch", "Vontikoppal Branch", "Gokulam Branch"],
  },
  Nagpur: {
    state: "Maharashtra",
    branches: ["Main Branch", "Sitabuldi Branch", "Dharampeth Branch"],
  },
  Nashik: {
    state: "Maharashtra",
    branches: ["Main Branch", "College Road Branch", "Gangapur Road Branch"],
  },
  Noida: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Sector 18 Branch", "Sector 62 Branch", "Greater Noida Branch"],
  },
  Patna: {
    state: "Bihar",
    branches: ["Main Branch", "Boring Road Branch", "Kankarbagh Branch"],
  },
  Pune: {
    state: "Maharashtra",
    branches: ["Main Branch", "Koregaon Park Branch", "Kothrud Branch", "Wakad Branch"],
  },
  Raipur: {
    state: "Chhattisgarh",
    branches: ["Main Branch", "Pandri Branch", "Devendra Nagar Branch"],
  },
  Ranchi: {
    state: "Jharkhand",
    branches: ["Main Branch", "Lalpur Branch", "Hinoo Branch"],
  },
  Surat: {
    state: "Gujarat",
    branches: ["Main Branch", "Ring Road Branch", "Adajan Branch"],
  },
  Thane: {
    state: "Maharashtra",
    branches: ["Main Branch", "Naupada Branch", "Wagle Estate Branch"],
  },
  Thiruvananthapuram: {
    state: "Kerala",
    branches: ["Main Branch", "MG Road Branch", "Kowdiar Branch"],
  },
  Vadodara: {
    state: "Gujarat",
    branches: ["Main Branch", "Alkapuri Branch", "Fatehgunj Branch"],
  },
  Varanasi: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Lahurabir Branch", "Sigra Branch"],
  },
  Vijayawada: {
    state: "Andhra Pradesh",
    branches: ["Main Branch", "Governorpet Branch", "Labbipet Branch"],
  },
  Visakhapatnam: {
    state: "Andhra Pradesh",
    branches: ["Main Branch", "Dwaraka Nagar Branch", "MVP Colony Branch"],
  },
}

export const CITIES = Object.keys(BRANCH_LOCATIONS).sort()
