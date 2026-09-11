import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

interface TokenLogoProps {
  uri?: string | null;
  symbol: string;
  size?: number;
}

export function TokenLogo({
  uri,
  symbol,
  size = 36,
}: TokenLogoProps) {
  const [failed, setFailed] = useState(!uri);
  const letter = (symbol || "?").slice(0, 1).toUpperCase();

  if (failed || !uri) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    color: colors.accent,
    fontWeight: "700",
  },
});
