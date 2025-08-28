// Process management and crash handling exports
export { 
  ProcessCrashHandler, 
  setupGlobalErrorHandlers, 
  ProcessHealthMonitor,
  withCrashReporting
} from "./crash-handler.ts";
export type { 
  CrashReport, 
  RecoveryOptions 
} from "./crash-handler.ts";