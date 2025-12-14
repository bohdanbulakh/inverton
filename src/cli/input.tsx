import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export const Input: React.FC<Props> = ({ label, value, onChange, onSubmit, placeholder }) => {
  return (
    <Box flexDirection="row" borderStyle="round" borderColor="blue" paddingX={1}>
      <Box marginRight={1}>
        <Text color="green" bold>{label}:</Text>
      </Box>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
};
