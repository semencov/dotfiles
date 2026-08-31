export interface PromptChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export interface ConfirmPrompt {
  readonly message: string;
  readonly initialValue?: boolean;
}

export interface MultiSelectPrompt<T extends string> {
  readonly message: string;
  readonly choices: readonly PromptChoice<T>[];
  readonly initialValues?: readonly T[];
  readonly required?: boolean;
}

export interface PromptAdapter {
  confirm(prompt: ConfirmPrompt): Promise<boolean>;
  multiselect<T extends string>(prompt: MultiSelectPrompt<T>): Promise<readonly T[]>;
}

export interface ClackApi {
  confirm(options: Readonly<Record<string, unknown>>): Promise<unknown>;
  multiselect(options: Readonly<Record<string, unknown>>): Promise<unknown>;
  isCancel(value: unknown): boolean;
}

const defaultClackApi: ClackApi = {
  confirm: async (options) => clackConfirm(options as unknown as Parameters<typeof clackConfirm>[0]),
  multiselect: async (options) => clackMultiselect(options as unknown as Parameters<typeof clackMultiselect>[0]),
  isCancel,
};

export class ClackPromptAdapter implements PromptAdapter {
  public constructor(private readonly api: ClackApi = defaultClackApi) {}

  public async confirm(prompt: ConfirmPrompt): Promise<boolean> {
    const result = await this.api.confirm({
      message: prompt.message,
      ...(prompt.initialValue === undefined ? {} : { initialValue: prompt.initialValue }),
    });
    if (this.api.isCancel(result)) throw new UserCancelledError();
    if (typeof result !== "boolean") throw new TypeError("Prompt returned a non-boolean result");
    return result;
  }

  public async multiselect<T extends string>(prompt: MultiSelectPrompt<T>): Promise<readonly T[]> {
    const result = await this.api.multiselect({
      message: prompt.message,
      options: prompt.choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.hint === undefined ? {} : { hint: choice.hint }),
      })),
      ...(prompt.initialValues === undefined ? {} : { initialValues: [...prompt.initialValues] }),
      ...(prompt.required === undefined ? {} : { required: prompt.required }),
    });
    if (this.api.isCancel(result)) throw new UserCancelledError();
    if (!Array.isArray(result) || !result.every((value) => typeof value === "string")) {
      throw new TypeError("Prompt returned a non-string selection");
    }
    return result as T[];
  }
}
import { confirm as clackConfirm, isCancel, multiselect as clackMultiselect } from "@clack/prompts";

import { UserCancelledError } from "./errors";
