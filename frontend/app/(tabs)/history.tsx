import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '@/theme/theme';

export default function History() {
    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.text }}>This is the User's History Page</Text>
        </View>
    )
}