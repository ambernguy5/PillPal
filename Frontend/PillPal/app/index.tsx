import { View, Text, Button } from "react-native";
import { Link } from "expo-router";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Welcome to PillPal 💊</Text>
      <Link href="/scan" asChild>
        <Button title="Scan Medication Label" />
      </Link>
    </View>
  );
}
