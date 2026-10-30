/**
 * Lightweight, zero-dependency, Zod-compatible runtime schema engine.
 * Provides identical `.strict()`, `.safeParse()`, `.parse()`, and `.flatten()`
 * semantics so schemas execute identically in Node serverless functions, browser
 * bundles, and offline sandbox test environments.
 */

export interface ZodIssue {
  path: (string | number)[];
  message: string;
}

export class ZodError extends Error {
  public readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super(issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; '));
    this.name = 'ZodError';
    this.issues = issues;
  }

  public flatten(): { formErrors: string[]; fieldErrors: Record<string, string[]> } {
    const formErrors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of this.issues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message);
      } else {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) {
          fieldErrors[key] = [];
        }
        fieldErrors[key].push(issue.message);
      }
    }
    return { formErrors, fieldErrors };
  }
}

export type SafeParseReturnType<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError };

export abstract class ZodType<T> {
  protected _isOptional = false;
  protected _isNullable = false;
  protected _defaultValue: { hasDefault: boolean; value?: T } = { hasDefault: false };
  protected _refinements: Array<{ check: (val: T) => boolean; message: string; path?: string[] }> = [];
  protected _transforms: Array<(val: any) => any> = [];

  protected abstract _parseBase(input: unknown, path: (string | number)[]): { ok: true; value: any } | { ok: false; issues: ZodIssue[] };

  public safeParse(input: unknown, path: (string | number)[] = []): SafeParseReturnType<T> {
    if (input === undefined) {
      if (this._defaultValue.hasDefault) {
        return { success: true, data: structuredClone(this._defaultValue.value) as T };
      }
      if (this._isOptional) {
        return { success: true, data: undefined as unknown as T };
      }
      return {
        success: false,
        error: new ZodError([{ path, message: 'Required field is missing.' }]),
      };
    }

    if (input === null) {
      if (this._isNullable) {
        return { success: true, data: null as unknown as T };
      }
      return {
        success: false,
        error: new ZodError([{ path, message: 'Expected non-null value.' }]),
      };
    }

    const baseResult = this._parseBase(input, path);
    if (!baseResult.ok) {
      return { success: false, error: new ZodError(baseResult.issues) };
    }

    let currentVal = baseResult.value;
    for (const transformFn of this._transforms) {
      currentVal = transformFn(currentVal);
    }

    const issues: ZodIssue[] = [];
    for (const refinement of this._refinements) {
      if (!refinement.check(currentVal)) {
        issues.push({
          path: refinement.path ? [...path, ...refinement.path] : path,
          message: refinement.message,
        });
      }
    }

    if (issues.length > 0) {
      return { success: false, error: new ZodError(issues) };
    }

    return { success: true, data: currentVal as T };
  }

  public parse(input: unknown): T {
    const result = this.safeParse(input);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  public optional(): ZodType<T | undefined> {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    clone._isOptional = true;
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    return clone;
  }

  public nullable(): ZodType<T | null> {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    clone._isNullable = true;
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    return clone;
  }

  public default(defaultValue: T): ZodType<T> {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    clone._defaultValue = { hasDefault: true, value: defaultValue };
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    return clone;
  }

  public refine(check: (val: T) => boolean, message: string, path?: string[]): this {
    this._refinements.push({ check, message, path });
    return this;
  }

  public transform<U>(fn: (val: T) => U): ZodType<U> {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    clone._transforms = [...this._transforms, fn];
    clone._refinements = [...this._refinements];
    return clone as unknown as ZodType<U>;
  }
}

export class ZodString extends ZodType<string> {
  private _minLen: { len: number; message: string } | null = null;
  private _maxLen: { len: number; message: string } | null = null;
  private _regexChecks: Array<{ regex: RegExp; message: string }> = [];
  private _shouldTrim = false;

  public trim(): this {
    this._shouldTrim = true;
    return this;
  }

  public min(len: number, message = `Must be at least ${len} characters.`): this {
    this._minLen = { len, message };
    return this;
  }

  public max(len: number, message = `Must be at most ${len} characters.`): this {
    this._maxLen = { len, message };
    return this;
  }

  public regex(regex: RegExp, message = 'Invalid format.'): this {
    this._regexChecks.push({ regex, message });
    return this;
  }

  protected _parseBase(input: unknown, path: (string | number)[]) {
    if (typeof input !== 'string') {
      return { ok: false as const, issues: [{ path, message: 'Expected a string value.' }] };
    }
    let val = input.replace(/\r\n/g, '\n');
    if (this._shouldTrim) {
      val = val.trim();
    }
    const issues: ZodIssue[] = [];
    if (this._minLen && val.length < this._minLen.len) {
      issues.push({ path, message: this._minLen.message });
    }
    if (this._maxLen && val.length > this._maxLen.len) {
      issues.push({ path, message: this._maxLen.message });
    }
    for (const check of this._regexChecks) {
      if (!check.regex.test(val)) {
        issues.push({ path, message: check.message });
      }
    }
    if (issues.length > 0) {
      return { ok: false as const, issues };
    }
    return { ok: true as const, value: val };
  }
}

export class ZodNumber extends ZodType<number> {
  private _minVal: { val: number; message: string } | null = null;
  private _maxVal: { val: number; message: string } | null = null;
  private _isInt = false;

  public int(message = 'Expected an integer.'): this {
    this._isInt = true;
    void message;
    return this;
  }

  public min(val: number, message = `Must be at least ${val}.`): this {
    this._minVal = { val, message };
    return this;
  }

  public max(val: number, message = `Must be at most ${val}.`): this {
    this._maxVal = { val, message };
    return this;
  }

  protected _parseBase(input: unknown, path: (string | number)[]) {
    if (typeof input !== 'number' || Number.isNaN(input) || !Number.isFinite(input)) {
      return { ok: false as const, issues: [{ path, message: 'Expected a valid number.' }] };
    }
    const issues: ZodIssue[] = [];
    if (this._isInt && !Number.isInteger(input)) {
      issues.push({ path, message: 'Expected an integer.' });
    }
    if (this._minVal && input < this._minVal.val) {
      issues.push({ path, message: this._minVal.message });
    }
    if (this._maxVal && input > this._maxVal.val) {
      issues.push({ path, message: this._maxVal.message });
    }
    if (issues.length > 0) {
      return { ok: false as const, issues };
    }
    return { ok: true as const, value: input };
  }
}

export class ZodEnum<T extends readonly [string, ...string[]]> extends ZodType<T[number]> {
  private readonly _values: T;

  constructor(values: T) {
    super();
    this._values = values;
  }

  protected _parseBase(input: unknown, path: (string | number)[]) {
    if (typeof input !== 'string' || !this._values.includes(input)) {
      return {
        ok: false as const,
        issues: [
          {
            path,
            message: `Must be one of: ${this._values.join(', ')}.`,
          },
        ],
      };
    }
    return { ok: true as const, value: input as T[number] };
  }
}

export class ZodArray<T> extends ZodType<T[]> {
  private readonly _itemSchema: ZodType<T>;
  private _maxItems: { max: number; message: string } | null = null;

  constructor(itemSchema: ZodType<T>) {
    super();
    this._itemSchema = itemSchema;
  }

  public max(max: number, message = `Maximum ${max} items allowed.`): this {
    this._maxItems = { max, message };
    return this;
  }

  protected _parseBase(input: unknown, path: (string | number)[]) {
    if (!Array.isArray(input)) {
      return { ok: false as const, issues: [{ path, message: 'Expected an array.' }] };
    }
    const issues: ZodIssue[] = [];
    if (this._maxItems && input.length > this._maxItems.max) {
      issues.push({ path, message: this._maxItems.message });
    }
    const parsedItems: T[] = [];
    input.forEach((item, index) => {
      const res = this._itemSchema.safeParse(item, [...path, index]);
      if (!res.success) {
        issues.push(...res.error.issues);
      } else {
        parsedItems.push(res.data);
      }
    });
    if (issues.length > 0) {
      return { ok: false as const, issues };
    }
    return { ok: true as const, value: parsedItems };
  }
}

export class ZodObject<Shape extends Record<string, ZodType<any>>> extends ZodType<{
  [K in keyof Shape]: Shape[K] extends ZodType<infer U> ? U : never;
}> {
  private readonly _shape: Shape;
  private _strictMode = false;

  constructor(shape: Shape) {
    super();
    this._shape = shape;
  }

  public strict(): this {
    this._strictMode = true;
    return this;
  }

  protected _parseBase(input: unknown, path: (string | number)[]) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { ok: false as const, issues: [{ path, message: 'Expected a JSON object.' }] };
    }
    const record = input as Record<string, unknown>;
    const issues: ZodIssue[] = [];

    if (this._strictMode) {
      const allowedKeys = new Set(Object.keys(this._shape));
      for (const key of Object.keys(record)) {
        if (!allowedKeys.has(key)) {
          issues.push({
            path: [...path, key],
            message: `Unrecognized or forbidden property "${key}".`,
          });
        }
      }
    }

    const output: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(this._shape)) {
      const fieldResult = fieldSchema.safeParse(record[key], [...path, key]);
      if (!fieldResult.success) {
        issues.push(...fieldResult.error.issues);
      } else if (fieldResult.data !== undefined) {
        output[key] = fieldResult.data;
      }
    }

    if (issues.length > 0) {
      return { ok: false as const, issues };
    }
    return { ok: true as const, value: output };
  }
}

export const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  enum: <T extends readonly [string, ...string[]]>(values: T) => new ZodEnum(values),
  array: <T>(itemSchema: ZodType<T>) => new ZodArray(itemSchema),
  object: <Shape extends Record<string, ZodType<any>>>(shape: Shape) => new ZodObject(shape),
};
