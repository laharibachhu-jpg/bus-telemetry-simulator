export type BusStatus = 'IN_SERVICE' | 'STOPPED_AT_STATION' | 'IN_TRANSIT' | 'MAINTENANCE_REQUIRED' | 'FAULT_EMERGENCY';

export type CardType = 
  | 'ADULT_PASS'
  | 'STUDENT_DISCOUNT'
  | 'SENIOR_CITIZEN'
  | 'MOBILE_QR_PAY'
  | 'INSPECTOR_AUDIT'
  | 'INVALID_CARD'
  | 'EXPIRED_PASS';

export type TapResult = 
  | 'APPROVED'
  | 'FLAGGED_INSUFFICIENT_FUNDS'
  | 'EXPIRED_PASS'
  | 'DUPLICATE_TAP_30S'
  | 'INVALID_CARD_HASH'
  | 'READER_OFFLINE_QUEUED';

export interface BusStop {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  sequenceOrder: number;
  averagePassengersWaiting: number;
  fareZone: string;
}

export interface Route {
  id: string;
  number: string;
  name: string;
  color: string;
  origin: string;
  destination: string;
  stops: BusStop[];
  waypoints: [number, number][]; // [lat, lng] array
  totalDistanceKm: number;
  targetTripTimeMins: number;
}

export interface BusTelemetry {
  busId: string;
  vehicleNumber: string;
  routeId: string;
  driverId: string;
  driverName: string;
  status: BusStatus;
  currentSpeedKmh: number;
  headingDegrees: number;
  latitude: number;
  longitude: number;
  distanceAlongRouteKm: number;
  passengerCount: number;
  maxCapacity: number;
  
  // Engine & Mechanical Telemetry
  engineRpm: number;
  engineTempCelsius: number;
  fuelLevelPercent: number;
  batteryVoltage: number;
  doorState: 'CLOSED' | 'FRONT_OPEN' | 'REAR_OPEN' | 'ALL_OPEN';
  hvacTempCelsius: number;
  tirePressurePsi: number;
  
  // Navigation & Schedule Telemetry
  currentStopIndex: number;
  nextStopId: string;
  nextStopETASeconds: number;
  delayMinutes: number; // positive = late, negative = early
  
  // System Health
  cardReaderOnline: boolean;
  gpsSignalStrengthPercent: number;
  odometerTotalKm: number;
  lastUpdatedIso: string;
}

export interface CardTapAudit {
  id: string;
  timestamp: string;
  busId: string;
  routeId: string;
  stopId: string;
  cardHash: string; // Anonymous masked token
  cardType: CardType;
  action: 'TAP_IN' | 'TAP_OUT' | 'INSPECTION_SCAN';
  fareZone: string;
  fareCharged: number;
  remainingBalance: number;
  tapResult: TapResult;
  verificationLatencyMs: number;
  inspectorId?: string;
  flaggedForFraud: boolean;
  fraudReason?: string;
}

export interface InspectionAudit {
  id: string;
  timestamp: string;
  busId: string;
  inspectorName: string;
  passengersInspectedCount: number;
  validTicketsCount: number;
  violationsFoundCount: number;
  finesIssuedTotal: number;
  details: {
    passengerCardHash: string;
    status: 'VALID' | 'EVASION' | 'EXPIRED' | 'WRONG_ZONE';
    actionTaken: string;
  }[];
}

export interface TelemetryAlert {
  id: string;
  timestamp: string;
  busId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 
    | 'SPEEDING_EVENT'
    | 'CARD_READER_FAILURE'
    | 'OVERCROWDING_WARNING'
    | 'HARSH_BRAKING'
    | 'ENGINE_OVERHEAT'
    | 'SCHEDULE_DELAY'
    | 'FRAUD_BURST_DETECTED';
  message: string;
  resolved: boolean;
}

export interface PassengerFlowEvent {
  timestamp: string;
  busId: string;
  stopName: string;
  boardedCount: number;
  alightedCount: number;
  newPassengerTotal: number;
}
