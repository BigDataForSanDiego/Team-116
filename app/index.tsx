import React, { useState } from "react";
import {
    Text,
    View,
    StyleSheet,
    Image,
    SectionList,
    TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Appointment {
    id: string;
    doctor: string;
    date: string;
    location: string;
    photo: any; // Added photo property to Appointment interface
}

interface Doctor {
    name: string;
    specialization: string;
    photo: any; // Use `any` type for `require`
}

export default function Index() {
    // Adding state for userName and getting today's date
    const [userName, setUserName] = useState("John Doe");
    const [primaryDoctor, setPrimaryDoctor] = useState<Doctor>({
        name: "Carrie Johnson, MD",
        specialization: "Primary care doctor",
        photo: require("../assets/images/Doctor1.png"), // Local image using `require`
    });

    // Get today's date
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const upcomingAppointments: Appointment[] = [
        {
            id: "1",
            doctor: "Maria Diaz, DPM",
            date: "October 21, 2024 at 9:00am",
            location: "1234 Oak Dr., La Mesa, CA 91942 Floor 3",
            photo: require("../assets/images/Doctor2.png"), // Local image for the appointment
        },
    ]; // Empty array for no upcoming appointments

    const pastAppointments: Appointment[] = [
        {
            id: "2",
            doctor: "Carrie Johnson, MD",
            date: "September 20, 2024 at 1:00pm",
            location: "5678 Maple St., San Diego, CA 92103 Floor 2",
            photo: require("../assets/images/Doctor1.png"), // Local image for past appointment
        },
        {
            id: "3",
            doctor: "Robert Smith, DDS",
            date: "August 15, 2024 at 10:30am",
            location: "9101 Birch Ave., El Cajon, CA 92020 Floor 1",
            photo: require("../assets/images/Doctor1.png"),
        },
    ]; // Empty array for no past appointments

    const sections = [
        {
            title: `Welcome, ${userName}!`,
            data: [primaryDoctor],
            renderItem: () => (
                <View style={styles.primaryDoctorCard}>
                    <Image
                        source={primaryDoctor.photo}
                        style={styles.doctorImage}
                    />
                    <View style={styles.doctorDetails}>
                        <Text style={styles.doctorName}>
                            {primaryDoctor.name}
                        </Text>
                        <Text style={styles.doctorSpecialization}>
                            {primaryDoctor.specialization}
                        </Text>
                    </View>
                </View>
            ),
        },
        {
            title: "Your upcoming appointments",
            data: upcomingAppointments.length > 0 ? upcomingAppointments : [{}], // Show placeholder if empty
            renderItem: ({ item }: { item: Appointment }) =>
                upcomingAppointments.length > 0 ? (
                    <View style={styles.appointmentCard}>
                        <View style={styles.cardHeader}>
                            <Image
                                source={item.photo}
                                style={styles.doctorImage}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.doctorName}>
                                    {item.doctor}
                                </Text>
                                <Text style={styles.specialization}>
                                    Podiatry
                                </Text>
                            </View>
                            <TouchableOpacity>
                                <Ionicons
                                    name="create-outline"
                                    size={24}
                                    color="#007bff"
                                />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.cardContent}>
                            <View style={styles.iconRow}>
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color="#333"
                                    style={styles.icon}
                                />
                                <Text style={styles.detailText}>
                                    {item.date}
                                </Text>
                            </View>
                            <View style={styles.iconRow}>
                                <Ionicons
                                    name="location-outline"
                                    size={20}
                                    color="#333"
                                    style={styles.icon}
                                />
                                <Text style={styles.detailText}>
                                    {item.location}
                                </Text>
                            </View>
                            <View style={styles.iconRow}>
                                <Ionicons
                                    name="chatbubbles-outline"
                                    size={20}
                                    color="#333"
                                    style={styles.icon}
                                />
                                <Text style={styles.detailText}>
                                    Appointment booked with Nexus.AI
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.checkInButton}>
                                <Text style={styles.checkInText}>
                                    Early check-in available
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noAppointmentContainer}>
                        <Text style={styles.noAppointmentText}>
                            No upcoming appointments.
                        </Text>
                        <TouchableOpacity style={styles.bookButton}>
                            <Text style={styles.bookButtonText}>
                                Book Appointment
                            </Text>
                        </TouchableOpacity>
                    </View>
                ),
        },
        {
            title: "Past Appointments",
            data: pastAppointments.length > 0 ? pastAppointments : [{}], // Show placeholder if empty
            renderItem: ({ item }: { item: Appointment }) =>
                pastAppointments.length > 0 ? (
                    <View style={styles.appointmentCard}>
                        <View style={styles.cardHeader}>
                            <Image
                                source={item.photo}
                                style={styles.doctorImage}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.doctorName}>
                                    {item.doctor}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.summaryButton}>
                            <Text style={styles.summaryText}>
                                View Appointment Summary
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.noAppointmentContainer}>
                        <Text style={styles.noAppointmentText}>
                            No past appointments.
                        </Text>
                    </View>
                ),
        },
    ];

    return (
        <View style={styles.container}>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id || Math.random().toString()} // Use random key for placeholders
                renderSectionHeader={({ section: { title } }) => (
                    <View>
                        <Text
                            style={
                                title.includes("Welcome")
                                    ? styles.welcomeHeader
                                    : styles.sectionHeader
                            }
                        >
                            {title}
                        </Text>
                        {title.includes("Welcome") && (
                            <Text style={styles.dateText}>{today}</Text>
                        )}
                    </View>
                )}
                renderItem={({ section, item }) => section.renderItem({ item })}
                style={styles.container}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#EFF4FF",
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    primaryDoctorCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    doctorImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 16,
    },
    doctorDetails: {
        flexDirection: "column",
    },
    doctorName: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#10063E",
    },
    doctorSpecialization: {
        fontSize: 16,
        color: "#666",
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#10063E",
        marginBottom: 10,
        marginTop: 20,
    },
    welcomeHeader: {
        fontSize: 30,
        fontWeight: "bold",
        color: "#10063E",
        marginBottom: 5,
        marginTop: 20,
    },
    dateText: {
        fontSize: 16,
        fontWeight: "500",
        color: "#666",
        marginBottom: 10,
    },
    appointmentCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    specialization: {
        color: "#777",
    },
    cardContent: {
        marginLeft: 10,
    },
    iconRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    icon: {
        fontSize: 20,
        marginRight: 8,
    },
    detailText: {
        fontSize: 12,
        color: "#10063E",
    },
    checkInButton: {
        marginTop: 12,
        backgroundColor: "#B1C0E8",
        borderRadius: 20,
        paddingVertical: 8,
        alignItems: "center",
    },
    checkInText: {
        fontSize: 16,
        color: "#10063E",
        fontWeight: "500",
    },
    summaryButton: {
        marginTop: 12,
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: "center",
    },
    summaryText: {
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    noAppointmentContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
    },
    noAppointmentText: {
        fontSize: 16,
        color: "#666",
    },
    bookButton: {
        marginTop: 12,
        backgroundColor: "#007bff",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: "center",
    },
    bookButtonText: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "500",
    },
});
