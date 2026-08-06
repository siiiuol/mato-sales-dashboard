export type ProductLine =
  | "MACHINE"
  | "BEHUIZING"
  | "PACKAGING"
  | "TERMINAL"
  | "TELEMETRY";

export type LeadStatus =
  | "NEW"
  | "TO_CALL"
  | "CONTACTED"
  | "FOLLOW_UP"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "DO_NOT_CONTACT";

export type DealStage =
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type OutreachOutcome =
  | "NO_ANSWER"
  | "VOICEMAIL"
  | "WRONG_NUMBER"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "CALLBACK"
  | "OTHER";
