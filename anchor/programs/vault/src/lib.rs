        use anchor_lang::prelude::*;
        use anchor_lang::system_program::{transfer, Transfer};


        declare_id!("Ah28Tt2zCqnMTcKjSwYvFayc7gB1Q98cNqsTHA2hE7wn");
        use Crate::constant::*
        #[program]

        pub mod SolQuiz {
            use super::*;
        }

        #[account]
        pub struct Lobby {
        pub host:u8,
            pub entry_fee: u64,
            pub max_players: u8,
            pub current_players: u8,
            pub status: u8,
            pub escrow_bump: u8,
            pub lobby_bump: u8,
        }

        #[derive(Accounts)] //Note this is the instruction context 
        pub struct CreateLobby<info'> {
        //This layer defines accounts that will be passed to this instruction
        #[account(mut)]
        pub host:Signer<info'>,
        #[account(
            init,  //automatically creates the account
            payer = host, //the account that will pay for the creation of this account 
            space = 8 + 1 + 8 + 1 + 1 + 1 + 1 + 1, //space needed to store the data in this account (8 bytes for discriminator and rest for the fields in the struct)
            seeds = []

        )]


