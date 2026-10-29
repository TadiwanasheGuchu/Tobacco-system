/**
 * Development / training data. Values for grades, prices, charges and rates are
 * SAMPLES: load the real grade list, contractor price lists, levies and the day's
 * exchange rate before going live.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";

const PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe2026";

const GRADES: [string, string][] = [
  ["L1O", "Leaf, quality 1, orange"],
  ["L2O", "Leaf, quality 2, orange"],
  ["L3O", "Leaf, quality 3, orange"],
  ["L4O", "Leaf, quality 4, orange"],
  ["L2L", "Leaf, quality 2, lemon"],
  ["L3L", "Leaf, quality 3, lemon"],
  ["X1O", "Lugs, quality 1, orange"],
  ["X2O", "Lugs, quality 2, orange"],
  ["X3L", "Lugs, quality 3, lemon"],
  ["C2O", "Cutters, quality 2, orange"],
  ["T2O", "Tips, quality 2, orange"],
  ["T4R", "Tips, quality 4, red"],
];

// Sample contractor price list, USD per kg.
const CONTRACT_PRICES: Record<string, string> = {
  L1O: "4.9000",
  L2O: "4.6000",
  L3O: "4.1000",
  L4O: "3.5000",
  L2L: "4.4000",
  L3L: "3.9000",
  X1O: "3.8000",
  X2O: "3.4000",
  X3L: "2.9000",
  C2O: "4.0000",
  T2O: "3.0000",
  T4R: "1.8000",
};

async function main() {
  const year = new Date().getFullYear();
  const season = await db.season.upsert({ where: { year }, update: { active: true }, create: { year, active: true } });

  const auction = await db.floor.upsert({
    where: { code: "HAF" },
    update: {},
    create: { code: "HAF", name: "Harare Auction Floor", type: "AUCTION" },
  });
  const contractFloor = await db.floor.upsert({
    where: { code: "HCF" },
    update: {},
    create: { code: "HCF", name: "Harare Contract Floor", type: "CONTRACT" },
  });

  const buyers = await Promise.all(
    [
      ["LTM", "Leaf Traders (Sample) Ltd", "TIMB-B-0001"],
      ["NKM", "Nyika Merchants (Sample)", "TIMB-B-0002"],
      ["ZCC", "Zambezi Contract Co (Sample)", "TIMB-B-0003"],
    ].map(([code, name, timbLicenseNumber]) =>
      db.buyer.upsert({ where: { code }, update: {}, create: { code, name, timbLicenseNumber } }),
    ),
  );
  const contractor = buyers[2];

  const grades = await Promise.all(
    GRADES.map(([code, description]) => db.grade.upsert({ where: { code }, update: {}, create: { code, description } })),
  );

  if ((await db.gradePrice.count({ where: { buyerId: contractor.id, seasonId: season.id } })) === 0) {
    await db.gradePrice.createMany({
      data: grades.map((g) => ({
        gradeId: g.id,
        buyerId: contractor.id,
        seasonId: season.id,
        pricePerKgUsd: CONTRACT_PRICES[g.code],
        effectiveFrom: new Date(`${year}-01-01T00:00:00Z`),
      })),
    });
  }

  if ((await db.chargeRule.count()) === 0) {
    const from = new Date(`${year}-01-01T00:00:00Z`);
    await db.chargeRule.createMany({
      data: [
        { code: "LEVY", name: "Statutory levy (sample rate)", kind: "PERCENT_OF_GROSS", value: "1.5", effectiveFrom: from },
        { code: "COMMISSION", name: "Floor commission (sample rate)", kind: "PERCENT_OF_GROSS", value: "3", floorType: "AUCTION", effectiveFrom: from },
        { code: "HANDLING", name: "Bale handling fee (sample)", kind: "PER_BALE", value: "2", effectiveFrom: from },
      ],
    });
  }
  if ((await db.paymentSplitRule.count()) === 0) {
    await db.paymentSplitRule.create({ data: { usdPercent: "70", effectiveFrom: new Date(`${year}-01-01T00:00:00Z`) } });
  }

  const passwordHash = await hashPassword(PASSWORD);
  const users = [
    { username: "admin", fullName: "System Admin", role: "ADMIN" as const },
    { username: "supervisor", fullName: "Floor Supervisor", role: "SUPERVISOR" as const, floorId: auction.id },
    { username: "reception", fullName: "Reception Clerk", role: "RECEPTION" as const, floorId: auction.id },
    { username: "reception2", fullName: "Contract Floor Clerk", role: "RECEPTION" as const, floorId: contractFloor.id },
    { username: "classifier", fullName: "TIMB Classifier", role: "CLASSIFIER" as const },
    { username: "buyer1", fullName: "Leaf Traders Buyer", role: "BUYER" as const, buyerId: buyers[0].id },
    { username: "buyer2", fullName: "Nyika Buyer", role: "BUYER" as const, buyerId: buyers[1].id },
    { username: "cashier", fullName: "Floor Cashier", role: "CASHIER" as const },
  ];
  for (const u of users) {
    await db.user.upsert({ where: { username: u.username }, update: {}, create: { ...u, passwordHash } });
  }
  const admin = await db.user.findUniqueOrThrow({ where: { username: "admin" } });

  if ((await db.exchangeRate.count()) === 0) {
    await db.exchangeRate.create({ data: { zigPerUsd: "26.8000", effectiveFrom: new Date(), capturedById: admin.id } });
  }

  const growers = [
    { timbGrowerNumber: "GR10001", firstName: "Tendai", lastName: "Moyo", nationalId: "63123456A42", district: "Marondera", province: "Mashonaland East", bankName: "Sample Bank", bankAccountNumber: "1002003001", mobileMoneyNumber: "0771000001" },
    { timbGrowerNumber: "GR10002", firstName: "Rudo", lastName: "Chikwanha", nationalId: "75234567B13", district: "Karoi", province: "Mashonaland West", mobileMoneyNumber: "0772000002" },
    { timbGrowerNumber: "GR10003", firstName: "Farai", lastName: "Ndlovu", nationalId: "08345678C21", district: "Mvurwi", province: "Mashonaland Central", bankName: "Sample Bank", bankAccountNumber: "1002003003" },
  ];
  for (const g of growers) {
    await db.grower.upsert({ where: { timbGrowerNumber: g.timbGrowerNumber }, update: {}, create: { ...g, timbVerifiedAt: new Date() } });
  }
  const farai = await db.grower.findUniqueOrThrow({ where: { timbGrowerNumber: "GR10003" } });
  await db.contract.upsert({
    where: { contractNumber: `ZCC-${year}-0001` },
    update: {},
    create: { contractNumber: `ZCC-${year}-0001`, growerId: farai.id, buyerId: contractor.id, seasonId: season.id, inputLoanUsd: "650.00" },
  });

  console.log(`Seeded season ${year}. Sign in as admin / supervisor / reception / classifier / buyer1 / cashier with password "${PASSWORD}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
