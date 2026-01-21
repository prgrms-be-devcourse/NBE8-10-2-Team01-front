"use client";

import * as React from "react";
import { TextInput } from "./TextInput";

type PasswordInputProps = {
  name: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PasswordInput(props: PasswordInputProps) {
  return <TextInput {...props} type="password" />;
}
