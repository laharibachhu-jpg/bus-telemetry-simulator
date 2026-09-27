import { BusTelemetry, CardTapAudit, TelemetryAlert, PassengerFlowEvent, CardType, TapResult, Route } from '../types/telemetry';
import { MOCK_ROUTES } from '../data/mockRoutes';

export class TelemetryEngine {
  private buses: BusTelemetry[];
  private routes: Route[];
  private cardAudits: CardTapAudit[] = [];
  private alerts: TelemetryAlert[] = [];
  private passengerFlows: PassengerFlowEvent[] = [];
  private simulationSpeedMultiplier = 1;
  private isPaused = false;
  private listeners: (() => void)[] = [];

  constructor(initialBuses: BusTelemetry[]) {
    this.buses = JSON.parse(JSON.stringify(initialBuses));
    this.routes = MOCK_ROUTES;
    this.generateInitialAudits();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public setSimulationSpeed(speed: number) {
    this.simulationSpeedMultiplier = speed;
    this.notify();
  }

  public getSimulationSpeed(): number {
    return this.simulationSpeedMultiplier;
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
    this.notify();
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getBuses(): BusTelemetry[] {
    return this.buses;
  }

  public getRoutes(): Route[] {
    return this.routes;
  }

  public getCardAudits(): CardTapAudit[] {
    return this.cardAudits;
  }

  public getAlerts(): TelemetryAlert[] {
    return this.alerts;
  }

  public getPassengerFlows(): PassengerFlowEvent[] {
    return this.passengerFlows;
  }

  private generateInitialAudits() {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      const timePast = new Date(now - (20 - i) * 15000).toISOString();
      const randomBus = this.buses[i % this.buses.length];
      const route = this.routes.find(r => r.id === randomBus.routeId) || this.routes[0];
      const stop = route.stops[i % route.stops.length];
      
      this.cardAudits.push(this.generateRandomTapAudit(randomBus.busId, route.id, stop.id, timePast));
    }
  }

  // Helper lat/lng distance math in KM
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  public tick() {
    if (this.isPaused) return;

    const dt = (1 * this.simulationSpeedMultiplier); // 1 second * speed

    this.buses.forEach(bus => {
      const route = this.routes.find(r => r.id === bus.routeId);
      if (!route) return;

      const waypoints = route.waypoints;
      if (!waypoints || waypoints.length < 2) return;

      // Update bus location along waypoints
      if (bus.status === 'IN_TRANSIT') {
        bus.currentSpeedKmh = Math.min(65, Math.max(25, bus.currentSpeedKmh + (Math.random() * 4 - 2)));
        bus.engineRpm = Math.floor(1200 + bus.currentSpeedKmh * 22);
        bus.doorState = 'CLOSED';

        // Move towards current waypoints
        const targetWaypointIndex = Math.min(bus.currentStopIndex + 1, waypoints.length - 1);
        const targetPoint = waypoints[targetWaypointIndex];
        const currentPoint: [number, number] = [bus.latitude, bus.longitude];

        const distanceToTarget = this.calculateDistance(currentPoint[0], currentPoint[1], targetPoint[0], targetPoint[1]);
        const moveStepKm = (bus.currentSpeedKmh / 3600) * dt * 0.1; // Simulated movement speed multiplier

        if (distanceToTarget <= moveStepKm || distanceToTarget < 0.001) {
          // Reached waypoint/stop
          bus.latitude = targetPoint[0];
          bus.longitude = targetPoint[1];
          bus.distanceAlongRouteKm += distanceToTarget;
          bus.odometerTotalKm += distanceToTarget;

          // Check if this waypoint matches a stop
          const matchingStop = route.stops.find(s => 
            Math.abs(s.latitude - targetPoint[0]) < 0.005 && 
            Math.abs(s.longitude - targetPoint[1]) < 0.005
          );

          if (matchingStop) {
            bus.status = 'STOPPED_AT_STATION';
            bus.currentSpeedKmh = 0;
            bus.engineRpm = 750 + Math.floor(Math.random() * 50);
            bus.doorState = Math.random() > 0.5 ? 'FRONT_OPEN' : 'ALL_OPEN';
            
            // Handle passenger boarding/alighting at station
            this.handleStationStop(bus, route, matchingStop);
          } else {
            bus.currentStopIndex = (targetWaypointIndex) % waypoints.length;
          }
        } else {
          // Linear interpolation toward target point
          const ratio = moveStepKm / distanceToTarget;
          bus.latitude += (targetPoint[0] - currentPoint[0]) * Math.min(1, ratio);
          bus.longitude += (targetPoint[1] - currentPoint[1]) * Math.min(1, ratio);
          bus.distanceAlongRouteKm += moveStepKm;
          bus.odometerTotalKm += moveStepKm;

          // Calculate heading
          const dLat = targetPoint[0] - currentPoint[0];
          const dLon = targetPoint[1] - currentPoint[1];
          bus.headingDegrees = Math.floor((Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360);
        }

        // Slight fuel decrease
        bus.fuelLevelPercent = Math.max(5, bus.fuelLevelPercent - 0.01 * dt);

      } else if (bus.status === 'STOPPED_AT_STATION') {
        // Countdown station wait time
        bus.nextStopETASeconds = Math.max(0, bus.nextStopETASeconds - dt);
        if (Math.random() < 0.2) {
          // Finish station stop and return to transit
          bus.status = 'IN_TRANSIT';
          bus.doorState = 'CLOSED';
          bus.currentStopIndex = (bus.currentStopIndex + 1) % waypoints.length;
          if (bus.currentStopIndex === 0) {
            bus.distanceAlongRouteKm = 0; // Loop around route
          }
          
          const nextStop = route.stops[(bus.currentStopIndex + 1) % route.stops.length];
          bus.nextStopId = nextStop ? nextStop.id : route.stops[0].id;
          bus.nextStopETASeconds = 180 + Math.floor(Math.random() * 60);
        }
      }

      // Overcrowding alert check
      if (bus.passengerCount >= bus.maxCapacity * 0.95) {
        this.addAlert({
          id: `alert-${Date.now()}-${bus.busId}`,
          timestamp: new Date().toISOString(),
          busId: bus.busId,
          severity: 'WARNING',
          type: 'OVERCROWDING_WARNING',
          message: `Bus ${bus.vehicleNumber} passenger capacity at ${Math.round((bus.passengerCount/bus.maxCapacity)*100)}% (${bus.passengerCount}/${bus.maxCapacity})`,
          resolved: false
        });
      }

      bus.lastUpdatedIso = new Date().toISOString();
    });

    this.notify();
  }

  private handleStationStop(bus: BusTelemetry, route: Route, stop: any) {
    const alightingCount = Math.min(bus.passengerCount, Math.floor(Math.random() * (bus.passengerCount * 0.4)));
    bus.passengerCount -= alightingCount;

    const maxBoardable = bus.maxCapacity - bus.passengerCount;
    const boardedCount = Math.min(maxBoardable, Math.floor(Math.random() * 8) + 1);
    bus.passengerCount += boardedCount;

    // Log passenger flow
    this.passengerFlows.unshift({
      timestamp: new Date().toISOString(),
      busId: bus.busId,
      stopName: stop.name,
      boardedCount,
      alightedCount,
      newPassengerTotal: bus.passengerCount
    });

    if (this.passengerFlows.length > 50) this.passengerFlows.pop();

    // Generate Card Tap Audits for boarding passengers
    for (let i = 0; i < boardedCount; i++) {
      const audit = this.generateRandomTapAudit(bus.busId, route.id, stop.id);
      this.cardAudits.unshift(audit);

      if (audit.tapResult !== 'APPROVED') {
        this.addAlert({
          id: `alert-tap-${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          busId: bus.busId,
          severity: audit.flaggedForFraud ? 'CRITICAL' : 'WARNING',
          type: 'FRAUD_BURST_DETECTED',
          message: `Card verification audit failed on ${bus.vehicleNumber}: ${audit.tapResult} (${audit.cardType})`,
          resolved: false
        });
      }
    }

    if (this.cardAudits.length > 100) {
      this.cardAudits = this.cardAudits.slice(0, 100);
    }
  }

  public generateRandomTapAudit(busId: string, routeId: string, stopId: string, customTime?: string): CardTapAudit {
    const cardTypes: CardType[] = ['ADULT_PASS', 'ADULT_PASS', 'STUDENT_DISCOUNT', 'MOBILE_QR_PAY', 'SENIOR_CITIZEN', 'INVALID_CARD', 'EXPIRED_PASS'];
    const selectedType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    
    let result: TapResult = 'APPROVED';
    let flagged = false;
    let fraudReason = undefined;

    if (selectedType === 'INVALID_CARD') {
      result = 'INVALID_CARD_HASH';
      flagged = true;
      fraudReason = 'Tampered RFID checksum';
    } else if (selectedType === 'EXPIRED_PASS') {
      result = 'EXPIRED_PASS';
      flagged = true;
      fraudReason = 'Pass expired 3 days ago';
    } else if (Math.random() < 0.08) {
      result = 'FLAGGED_INSUFFICIENT_FUNDS';
      flagged = true;
      fraudReason = 'Card balance -$1.50 below threshold';
    } else if (Math.random() < 0.04) {
      result = 'DUPLICATE_TAP_30S';
      flagged = true;
      fraudReason = 'Re-tap detected within 30s window';
    }

    const fareCharged = selectedType === 'STUDENT_DISCOUNT' ? 1.25 : selectedType === 'SENIOR_CITIZEN' ? 1.00 : 2.75;
    const cardHash = `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...${Math.random().toString(16).substring(2, 6).toUpperCase()}`;

    return {
      id: `tap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: customTime || new Date().toISOString(),
      busId,
      routeId,
      stopId,
      cardHash,
      cardType: selectedType,
      action: Math.random() > 0.85 ? 'TAP_OUT' : 'TAP_IN',
      fareZone: 'Zone 1',
      fareCharged: result === 'APPROVED' ? fareCharged : 0,
      remainingBalance: Math.floor(Math.random() * 45) + (result === 'FLAGGED_INSUFFICIENT_FUNDS' ? -1.5 : 5),
      tapResult: result,
      verificationLatencyMs: Math.floor(18 + Math.random() * 42),
      flaggedForFraud: flagged,
      fraudReason
    };
  }

  public triggerInspectorScan(busId: string, inspectorName: string = 'Officer J. Miller (ID #882)') {
    const bus = this.buses.find(b => b.busId === busId);
    if (!bus) return;

    const inspectedCount = Math.floor(Math.min(bus.passengerCount, 12 + Math.random() * 8));
    let violations = 0;
    const details = [];

    for (let i = 0; i < inspectedCount; i++) {
      const isEvader = Math.random() < 0.12;
      const passHash = `0xPASS_${Math.random().toString(16).substring(2, 8).toUpperCase()}`;
      if (isEvader) {
        violations++;
        details.push({
          passengerCardHash: passHash,
          status: 'EVASION' as const,
          actionTaken: 'Issued $75 Transit Audit Fine Notice'
        });
        
        // Push a card audit entry for the inspection scan
        this.cardAudits.unshift({
          id: `audit-scan-${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          busId,
          routeId: bus.routeId,
          stopId: bus.nextStopId,
          cardHash: passHash,
          cardType: 'INSPECTOR_AUDIT',
          action: 'INSPECTION_SCAN',
          fareZone: 'Zone 1',
          fareCharged: 75.00,
          remainingBalance: 0,
          tapResult: 'FLAGGED_INSUFFICIENT_FUNDS',
          verificationLatencyMs: 12,
          inspectorId: inspectorName,
          flaggedForFraud: true,
          fraudReason: 'Fare evasion ticket issued by transit police'
        });
      } else {
        details.push({
          passengerCardHash: passHash,
          status: 'VALID' as const,
          actionTaken: 'Verified active transit monthly subscription'
        });
      }
    }

    this.addAlert({
      id: `alert-inspect-${Date.now()}`,
      timestamp: new Date().toISOString(),
      busId,
      severity: violations > 0 ? 'CRITICAL' : 'INFO',
      type: 'FRAUD_BURST_DETECTED',
      message: `Audit Scan by ${inspectorName} on ${bus.vehicleNumber}: ${inspectedCount} passengers audited, ${violations} violation(s) logged.`,
      resolved: false
    });

    this.notify();
  }

  public injectFault(busId: string, faultType: 'CARD_READER_OFFLINE' | 'SPEEDING' | 'OVERHEAT' | 'HARSH_BRAKE') {
    const bus = this.buses.find(b => b.busId === busId);
    if (!bus) return;

    if (faultType === 'CARD_READER_OFFLINE') {
      bus.cardReaderOnline = false;
      this.addAlert({
        id: `fault-${Date.now()}`,
        timestamp: new Date().toISOString(),
        busId,
        severity: 'CRITICAL',
        type: 'CARD_READER_FAILURE',
        message: `Card Validator Terminal offline on ${bus.vehicleNumber}. Local offline queue enabled.`,
        resolved: false
      });
    } else if (faultType === 'SPEEDING') {
      bus.currentSpeedKmh = 82;
      this.addAlert({
        id: `fault-${Date.now()}`,
        timestamp: new Date().toISOString(),
        busId,
        severity: 'WARNING',
        type: 'SPEEDING_EVENT',
        message: `Speed limit violation on ${bus.vehicleNumber}: 82 km/h in 50 km/h municipal zone.`,
        resolved: false
      });
    } else if (faultType === 'OVERHEAT') {
      bus.engineTempCelsius = 108;
      bus.status = 'MAINTENANCE_REQUIRED';
      this.addAlert({
        id: `fault-${Date.now()}`,
        timestamp: new Date().toISOString(),
        busId,
        severity: 'CRITICAL',
        type: 'ENGINE_OVERHEAT',
        message: `Engine coolant critical temperature on ${bus.vehicleNumber}: 108°C!`,
        resolved: false
      });
    } else if (faultType === 'HARSH_BRAKE') {
      bus.currentSpeedKmh = 5;
      this.addAlert({
        id: `fault-${Date.now()}`,
        timestamp: new Date().toISOString(),
        busId,
        severity: 'WARNING',
        type: 'HARSH_BRAKING',
        message: `Harsh braking event detected on ${bus.vehicleNumber}: -2.8g deceleration.`,
        resolved: false
      });
    }

    this.notify();
  }

  public restoreBusStatus(busId: string) {
    const bus = this.buses.find(b => b.busId === busId);
    if (bus) {
      bus.cardReaderOnline = true;
      bus.engineTempCelsius = 88;
      bus.currentSpeedKmh = 35;
      bus.status = 'IN_TRANSIT';
      this.addAlert({
        id: `restore-${Date.now()}`,
        timestamp: new Date().toISOString(),
        busId,
        severity: 'INFO',
        type: 'SCHEDULE_DELAY',
        message: `Systems cleared and restored for ${bus.vehicleNumber}.`,
        resolved: true
      });
      this.notify();
    }
  }

  private addAlert(alert: TelemetryAlert) {
    this.alerts.unshift(alert);
    if (this.alerts.length > 30) this.alerts.pop();
  }
}
