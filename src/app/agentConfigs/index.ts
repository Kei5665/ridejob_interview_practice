import { AllAgentConfigsType } from "@/app/types";
// Remove imports for other agent sets
// import frontDeskAuthentication from "./frontDeskAuthentication";
// import customerServiceRetail from "./customerServiceRetail";
// import simpleExample from "./simpleExample";
import mockInterview from "./mockInterview";

export const allAgentSets: AllAgentConfigsType = {
  // Remove other agent sets
  // frontDeskAuthentication,
  // customerServiceRetail,
  // simpleExample,
  mockInterview, // Keep only mockInterview
};

// Set mockInterview as the default
export const defaultAgentSetKey = "mockInterview";
