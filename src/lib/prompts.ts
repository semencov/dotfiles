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
