/**
 * TextInput — touch-friendly input with label, error state, and theme-aware styling.
 */

import React from 'react';
import { View, Text, TextInput as RNTextInput, type TextInputProps } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function TextInput({
  label,
  error,
  hint,
  required,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline,
  numberOfLines,
  testID,
  style,
}: InputProps) {
  const Colors = useThemeColors();
  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: Colors.fgSecondary,
            marginBottom: 6,
          }}
        >
          {label}
          {required && <Text style={{ color: Colors.danger }}> *</Text>}
        </Text>
      )}
      <RNTextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.fgSubtle}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={{
          minHeight: 48,
          borderWidth: 1.5,
          borderColor: error ? Colors.danger : Colors.inputBorder,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 16,
          color: Colors.fg,
          backgroundColor: Colors.inputBg,
          ...(multiline ? { minHeight: 96, textAlignVertical: 'top' } : {}),
          ...style,
        }}
      />
      {error && (
        <Text style={{ fontSize: 12, color: Colors.danger, marginTop: 4 }}>{error}</Text>
      )}
      {hint && !error && (
        <Text style={{ fontSize: 12, color: Colors.fgMuted, marginTop: 4 }}>{hint}</Text>
      )}
    </View>
  );
}
