import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pulsepocket:hasSeenWelcome";

export async function hasSeenWelcome(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === "true";
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "true");
}
