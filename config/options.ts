import { Options } from "k6/options";

export const options: Options = {
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  discardResponseBodies: false,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};
