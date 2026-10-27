import { Tabs } from "expo-router";
import { View } from "react-native";

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}><Tabs.Screen name="index" /><Tabs.Screen name="my-requests" /></Tabs>;
}
