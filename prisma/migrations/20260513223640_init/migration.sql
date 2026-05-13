-- CreateEnum
CREATE TYPE "TreeRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FamilyType" AS ENUM ('MARRIAGE', 'UNION', 'RELIGIOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "FilialLink" AS ENUM ('BIOLOGICAL', 'ADOPTIVE', 'FOSTER', 'STEP', 'RECOGNIZED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIRTH', 'DEATH', 'MARRIAGE', 'DIVORCE', 'BAPTISM', 'CONFIRMATION', 'BURIAL', 'CREMATION', 'CENSUS', 'IMMIGRATION', 'EMIGRATION', 'NATURALIZATION', 'OCCUPATION', 'RESIDENCE', 'EDUCATION', 'MILITARY_SERVICE', 'WILL', 'PROBATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DateQualifier" AS ENUM ('EXACT', 'ABOUT', 'BEFORE', 'AFTER', 'BETWEEN', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('WITNESS', 'OFFICIANT', 'GODPARENT', 'INFORMANT', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('BIRTH_CERTIFICATE', 'DEATH_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'PARISH_REGISTER', 'CENSUS', 'NEWSPAPER', 'PERSONAL_RECORD', 'ARCHIVE', 'WEBSITE', 'ORAL_TESTIMONY', 'OTHER');

-- CreateEnum
CREATE TYPE "CitationQuality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Tree" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreeMember" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TreeRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "givenName" TEXT,
    "surname" TEXT,
    "marriedName" TEXT,
    "nickname" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "isLiving" BOOLEAN NOT NULL DEFAULT false,
    "privacy" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "type" "FamilyType" NOT NULL DEFAULT 'MARRIAGE',
    "spouseAId" TEXT,
    "spouseBId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyChild" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "link" "FilialLink" NOT NULL DEFAULT 'BIOLOGICAL',
    "notes" TEXT,

    CONSTRAINT "FamilyChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "link" "FilialLink" NOT NULL DEFAULT 'BIOLOGICAL',
    "notes" TEXT,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "date" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "dateQualifier" "DateQualifier" NOT NULL DEFAULT 'EXACT',
    "dateText" TEXT,
    "placeId" TEXT,
    "personId" TEXT,
    "familyId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "region" TEXT,
    "country" TEXT DEFAULT 'France',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "date" TIMESTAMP(3),
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "page" TEXT,
    "date" TIMESTAMP(3),
    "quality" "CitationQuality" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "eventId" TEXT,
    "personId" TEXT,
    "familyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "caption" TEXT,
    "date" TIMESTAMP(3),
    "personId" TEXT,
    "eventId" TEXT,
    "sourceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "TreeMember_userId_idx" ON "TreeMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TreeMember_treeId_userId_key" ON "TreeMember"("treeId", "userId");

-- CreateIndex
CREATE INDEX "Person_treeId_surname_idx" ON "Person"("treeId", "surname");

-- CreateIndex
CREATE INDEX "Person_treeId_givenName_idx" ON "Person"("treeId", "givenName");

-- CreateIndex
CREATE INDEX "Family_treeId_spouseAId_idx" ON "Family"("treeId", "spouseAId");

-- CreateIndex
CREATE INDEX "Family_treeId_spouseBId_idx" ON "Family"("treeId", "spouseBId");

-- CreateIndex
CREATE INDEX "FamilyChild_childId_idx" ON "FamilyChild"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyChild_familyId_childId_key" ON "FamilyChild"("familyId", "childId");

-- CreateIndex
CREATE INDEX "Relationship_treeId_childId_idx" ON "Relationship"("treeId", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_parentId_childId_key" ON "Relationship"("parentId", "childId");

-- CreateIndex
CREATE INDEX "Event_treeId_type_idx" ON "Event"("treeId", "type");

-- CreateIndex
CREATE INDEX "Event_personId_idx" ON "Event"("personId");

-- CreateIndex
CREATE INDEX "Event_familyId_idx" ON "Event"("familyId");

-- CreateIndex
CREATE INDEX "Event_treeId_date_idx" ON "Event"("treeId", "date");

-- CreateIndex
CREATE INDEX "EventParticipant_personId_idx" ON "EventParticipant"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_personId_role_key" ON "EventParticipant"("eventId", "personId", "role");

-- CreateIndex
CREATE INDEX "Place_treeId_name_idx" ON "Place"("treeId", "name");

-- CreateIndex
CREATE INDEX "Source_treeId_title_idx" ON "Source"("treeId", "title");

-- CreateIndex
CREATE INDEX "Citation_sourceId_idx" ON "Citation"("sourceId");

-- CreateIndex
CREATE INDEX "Citation_eventId_idx" ON "Citation"("eventId");

-- CreateIndex
CREATE INDEX "Citation_personId_idx" ON "Citation"("personId");

-- CreateIndex
CREATE INDEX "Citation_familyId_idx" ON "Citation"("familyId");

-- CreateIndex
CREATE INDEX "Media_personId_idx" ON "Media"("personId");

-- CreateIndex
CREATE INDEX "Media_eventId_idx" ON "Media"("eventId");

-- CreateIndex
CREATE INDEX "Media_sourceId_idx" ON "Media"("sourceId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeMember" ADD CONSTRAINT "TreeMember_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeMember" ADD CONSTRAINT "TreeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_spouseAId_fkey" FOREIGN KEY ("spouseAId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_spouseBId_fkey" FOREIGN KEY ("spouseBId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyChild" ADD CONSTRAINT "FamilyChild_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyChild" ADD CONSTRAINT "FamilyChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
