export interface ABTestVariant {
  key: string
  name: string
  traffic: number
}

export interface ABTestConfig {
  name: string
  description: string
  variants: ABTestVariant[]
  startDate: string
  endDate?: string
}
